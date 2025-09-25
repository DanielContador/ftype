<?php
defined('MOODLE_INTERNAL') || die();

global $CFG;


class profile_field_hierarchicalmenu extends profile_field_base {

    /** @var array decoded tree {root:{items:[...]}} */
    protected $tree = ['root' => ['items' => []]];

    /** @var array current selection ['level0'=>id, 'level1'=>id, 'level2'=>id] */
    protected $current = [];

    public function __construct($fieldid = 0, $userid = 0, $fielddata = null) {
        parent::__construct($fieldid, $userid, $fielddata);

        // Parse JSON tree from param1.
        $this->tree = ['root' => ['items' => []]];
        if (!empty($this->field->param1)) {
            $decoded = json_decode($this->field->param1, true);
            if (json_last_error() === JSON_ERROR_NONE && isset($decoded['root']['items'])) {
                $this->tree = $decoded;
            }
        }

        $this->current = $this->normalise_selection($this->data);
    }

    /**
     * Build 3 cascading selects. Names are an array under $this->inputname.
     */
    public function edit_field_add($mform) {
        global $PAGE;

        // Add three selects with array names: inputname[level0], [level1], [level2]
        $mform->addElement('select', $this->inputname.'[level0]', format_string($this->field->name).' – Level 1', []);
        $mform->addElement('select', $this->inputname.'[level1]', format_string($this->field->name).' – Level 2', []);
        $mform->addElement('select', $this->inputname.'[level2]', format_string($this->field->name).' – Level 3', []);

        $mform->setType($this->inputname.'[level0]', PARAM_RAW);
        $mform->setType($this->inputname.'[level1]', PARAM_RAW);
        $mform->setType($this->inputname.'[level2]', PARAM_RAW);

        // Hidden element stores the JSON payload that Moodle will persist.
        $mform->addElement('hidden', $this->inputname, '');
        $mform->setType($this->inputname, PARAM_TEXT);

        // Make them required if field is required (only level0 strictly required).
        if (!empty($this->field->required)) {
            $mform->addRule($this->inputname.'[level0]', get_string('required'), 'required', null, 'client');
        }

        // Pass JSON config to AMD to populate + wire cascading.
        $PAGE->requires->js_call_amd(
            'profilefield_hierarchicalmenu/selector',
            'init',
            [
                [
                    'root'      => $this->tree['root'],
                    'fieldname' => $this->inputname,
                    'current'   => $this->current,
                    'hidden'    => $this->inputname,
                    'labels'    => ['l0' => get_string('choose').'...', 'l1' => get_string('choose').'...', 'l2' => get_string('choose').'...']
                ]
            ]
        );
    }

    /**
     * Defaults for the selects.
     */
    public function edit_field_set_default($mform) {
        $default = $this->normalise_selection($this->field->defaultdata ?: $this->current);
        $mform->setDefault($this->inputname, $this->encode_selection($default));
    }

    /**
     * Save the selected IDs (not names) as JSON.
     * $data arrives as array: ['level0'=>id, 'level1'=>id, 'level2'=>id]
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
        return array(PARAM_TEXT, empty($this->field->required) ? NULL_ALLOWED : NULL_NOT_ALLOWED);
    }

    /**
     * Normalise posted/default data into the canonical array structure.
     *
     * @param mixed $value
     * @return array
     */
    protected function normalise_selection($value) {
        $base = ['level0' => '', 'level1' => '', 'level2' => ''];

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
            return json_encode(['level0' => '', 'level1' => '', 'level2' => '']);
        }

        return $encoded;
    }
}
