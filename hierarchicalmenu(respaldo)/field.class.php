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

        // Parse saved selection (stored as JSON string of IDs).
        $this->current = ['level0' => '', 'level1' => '', 'level2' => ''];
        if (!empty($this->data)) {
            $sel = json_decode($this->data, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($sel)) {
                $this->current = array_merge($this->current, $sel);
            }
        }
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
                    'labels'    => ['l0' => get_string('choose').'...', 'l1' => get_string('choose').'...', 'l2' => get_string('choose').'...']
                ]
            ]
        );
    }

    /**
     * Defaults for the selects.
     */
    public function edit_field_set_default($mform) {
        // If you want defaults, put them into $this->field->defaultdata as JSON of IDs.
        if (!empty($this->field->defaultdata)) {
            $def = json_decode($this->field->defaultdata, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($def)) {
                $mform->setDefault($this->inputname, $def);
            }
        } else if (!empty($this->current)) {
            $mform->setDefault($this->inputname, $this->current);
        }
    }

    /**
     * Save the selected IDs (not names) as JSON.
     * $data arrives as array: ['level0'=>id, 'level1'=>id, 'level2'=>id]
     */
    public function edit_save_data_preprocess($data, $datarecord) {
        if (is_array($data)) {
            // Normalize to strings; store only IDs
            $out = [
                'level0' => isset($data['level0']) ? (string)$data['level0'] : '',
                'level1' => isset($data['level1']) ? (string)$data['level1'] : '',
                'level2' => isset($data['level2']) ? (string)$data['level2'] : ''
            ];
            return json_encode($out);
        }
        return null;
    }

    /**
     * Load saved selection back into the form (array of ids).
     */
    public function edit_load_user_data($user) {
        // When loading, supply the array of IDs back.
        $user->{$this->inputname} = $this->current;
    }

    /**
     * Validation type.
     */
    public function get_field_properties() {
        // We save JSON text; NULL allowed if optional.
        return array(PARAM_TEXT, empty($this->field->required) ? NULL_ALLOWED : NULL_NOT_ALLOWED);
    }
}
