<?php
defined('MOODLE_INTERNAL') || die();

global $CFG;

class profile_field_hierarchicalmenu extends profile_field_base {

    /** @var array decoded tree {root:{items:[...]}} */
    protected $tree = ['root' => ['items' => []]];

    /** @var int total number of hierarchy levels configured for this field */
    protected $maxlevels = 3;

    /** @var array list of form keys e.g. ['level0', 'level1', ...] */
    protected $levelkeys = [];

    /** @var array human readable labels for each level */
    protected $levellabels = [];

    /** @var array current selection ['level0'=>id, ...] */
    protected $current = [];

    /** @var array flat index of nodes keyed by id */
    protected $nodesbyid = [];

    public function __construct($fieldid = 0, $userid = 0, $fielddata = null) {
        parent::__construct($fieldid, $userid, $fielddata);

        $this->tree = ['root' => ['items' => []]];
        if (!empty($this->field->param1)) {
            $decoded = json_decode($this->field->param1, true);
            if (json_last_error() === JSON_ERROR_NONE && isset($decoded['root']['items'])) {
                $this->tree = $decoded;
            }
        }

        $this->maxlevels   = $this->resolve_max_levels($this->field->param2 ?? null);
        $this->levelkeys   = $this->build_level_keys($this->maxlevels);
        $this->levellabels = $this->resolve_level_labels($this->field->param3 ?? '', $this->maxlevels);

        $this->current     = $this->normalise_selection($this->data);
        $this->nodesbyid   = [];
        $this->index_tree($this->tree['root']['items']);
    }

    /**
     * Build cascading selects based on the configured level count.
     */
    public function edit_field_add($mform) {
        global $PAGE;

        foreach ($this->levelkeys as $index => $key) {
            $label = $this->levellabels[$index] ?? get_string('levellabeldefault', 'profilefield_hierarchicalmenu', $index + 1);
            $formattedlabel = format_string($label, true, ['context' => \context_system::instance()]);
            $mform->addElement(
                'select',
                $this->inputname."[{$key}]",
                format_string($this->field->name) . ' – ' . $formattedlabel,
                []
            );
            $mform->setType($this->inputname."[{$key}]", PARAM_RAW);
        }

        // Hidden element stores the JSON payload that Moodle will persist.
        $mform->addElement('hidden', $this->inputname, '');
        // The hidden element stores JSON so we need to avoid text cleaning that would break encoding.
        $mform->setType($this->inputname, PARAM_RAW);

        // Make them required if field is required (only level0 strictly required).
        if (!empty($this->field->required) && isset($this->levelkeys[0])) {
            $mform->addRule($this->inputname.'['.$this->levelkeys[0].']', get_string('required'), 'required', null, 'client');
        }

        // Pass JSON config to AMD to populate + wire cascading.
        $levelsconfig = [];
        foreach ($this->levelkeys as $index => $key) {
            $label = $this->levellabels[$index] ?? get_string('levellabeldefault', 'profilefield_hierarchicalmenu', $index + 1);
            $levelsconfig[] = [
                'key' => $key,
                'placeholder' => get_string('chooselevel', 'profilefield_hierarchicalmenu', $label)
            ];
        }

        $PAGE->requires->js_call_amd(
            'profilefield_hierarchicalmenu/selector',
            'init',
            [[
                'root'      => $this->tree['root'],
                'fieldname' => $this->inputname,
                'current'   => $this->current,
                'hidden'    => $this->inputname,
                'levels'    => $levelsconfig
            ]]
        );
    }

    /**
     * Defaults for the selects.
     */
    public function edit_field_set_default($mform) {
        $default = $this->normalise_selection($this->field->defaultdata ?: $this->current);

        foreach ($this->levelkeys as $key) {
            $mform->setDefault($this->inputname . '[' . $key . ']', $default[$key] ?? '');
        }

        $mform->setDefault($this->inputname, $this->encode_selection($default));
    }

    /**
     * Save the selected IDs (not names) as JSON.
     */
    public function edit_save_data_preprocess($data, $datarecord) {
        $selection = $this->normalise_selection($data);
        return $this->encode_selection($selection);
    }

    /**
     * Load saved selection back into the form (array of ids).
     */
    public function edit_load_user_data($user) {
        $user->{$this->inputname} = $this->encode_selection($this->current);
    }

    /**
     * Validation type.
     */
    public function get_field_properties() {
        // We save JSON text; NULL allowed if optional.
        return [PARAM_RAW, empty($this->field->required) ? NULL_ALLOWED : NULL_NOT_ALLOWED];
    }

    /**
     * Normalise posted/default data into the canonical array structure.
     *
     * @param mixed $value
     * @return array
     */
    protected function normalise_selection($value) {
        $base = array_fill_keys($this->levelkeys, '');

        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $value = $decoded;
            }
        } else if ($value === null) {
            $value = [];
        }

        if ($value instanceof \stdClass) {
            $value = (array)$value;
        }

        if (!is_array($value)) {
            $value = [];
        }

        $out = $base;
        foreach ($base as $key => $default) {
            if (array_key_exists($key, $value) && $value[$key] !== null) {
                $out[$key] = (string)$value[$key];
            }
        }

        return $out;
    }

    /**
     * Encode the selection array as a JSON string for storage.
     *
     * @param array $selection
     * @return string
     */
    protected function encode_selection(array $selection) {
        $normalised = $this->normalise_selection($selection);
        $encoded = json_encode($normalised);

        if ($encoded === false) {
            // Should not happen but keep a predictable fallback.
            return json_encode(array_fill_keys($this->levelkeys, ''));
        }

        return $encoded;
    }

    /**
     * Display the selected hierarchy using the node names instead of raw JSON.
     *
     * @return string
     */
    public function display_data() {
        $selection = $this->normalise_selection($this->data);
        $names = [];

        foreach ($this->levelkeys as $level) {
            $id = $selection[$level] ?? '';
            if ($id !== '' && isset($this->nodesbyid[$id]['name'])) {
                $names[] = format_string(
                    $this->nodesbyid[$id]['name'],
                    true,
                    ['context' => \context_system::instance()]
                );
            }
        }

        if (empty($names)) {
            return '';
        }

        return implode(' / ', $names);
    }

    /**
     * Build a flat index of the tree nodes by id for quick lookup.
     *
     * @param array $nodes
     * @return void
     */
    protected function index_tree(array $nodes) {
        foreach ($nodes as $node) {
            if (isset($node['id'])) {
                $this->nodesbyid[(string)$node['id']] = $node;
            }

            if (!empty($node['childs']) && is_array($node['childs'])) {
                $this->index_tree($node['childs']);
            }
        }
    }

    /**
     * Determine the configured max levels, defaulting to 3.
     *
     * @param mixed $raw
     * @return int
     */
    protected function resolve_max_levels($raw) {
        $value = (int)$raw;
        if ($value < 1) {
            $value = 3;
        }
        return $value;
    }

    /**
     * Build level keys based on the max levels.
     *
     * @param int $maxlevels
     * @return array
     */
    protected function build_level_keys($maxlevels) {
        $keys = [];
        for ($i = 0; $i < $maxlevels; $i++) {
            $keys[] = 'level' . $i;
        }
        return $keys;
    }

    /**
     * Resolve human-readable labels for each hierarchy level.
     *
     * @param string $raw
     * @param int $maxlevels
     * @return array
     */
    protected function resolve_level_labels($raw, $maxlevels) {
        $labels = [];
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $labels = $decoded;
            } else {
                $labels = preg_split("/(\r\n|\r|\n)/", $raw);
            }
        }

        $labels = is_array($labels) ? array_values($labels) : [];

        $resolved = [];
        for ($i = 0; $i < $maxlevels; $i++) {
            $value = isset($labels[$i]) ? trim((string)$labels[$i]) : '';
            if ($value !== '') {
                $resolved[$i] = $value;
            } else {
                $resolved[$i] = get_string('levellabeldefault', 'profilefield_hierarchicalmenu', $i + 1);
            }
        }

        return $resolved;
    }
}
