<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Hierarchical menu profile field definition.
 *
 * @package    profilefield_hierarchicalmenu
 * @copyright  2007 onwards Shane Elliot {@link http://pukunui.com}
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Class profile_define_hierarchicalmenu
 *
 * @copyright  2007 onwards Shane Elliot {@link http://pukunui.com}
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class profile_define_hierarchicalmenu extends profile_define_base {

    /**
     * Adds elements to the form for creating/editing this type of profile field.
     * @param moodleform $form
     */
	public function define_form_specific($form) {
    global $PAGE;

    // Include CSS styles for the hierarchical category manager.
    $PAGE->requires->css('/user/profile/field/hierarchicalmenu/styles.css');

    $maxlevels = $this->resolve_max_levels($this->field->param2 ?? null);
    $rawlevellabels = $this->field->param3 ?? '';
    $labels = $this->resolve_level_labels($rawlevellabels, $maxlevels);
    $displaylabels = $this->prepare_labels_for_display($rawlevellabels);
    if ($displaylabels === '') {
        $displaylabels = implode("\n", $labels);
    }

    // Hidden textarea that will store the hierarchical categories in JSON format.
    $form->addElement('textarea', 'param1', get_string('profilemenuoptions', 'admin'),
        ['rows' => 6, 'cols' => 40, 'style' => 'display: none;']);
    $form->setType('param1', PARAM_TEXT);

    // ⚡ Sección movida arriba del category manager ⚡
    // Setting: number of hierarchy levels.
    $form->addElement('text', 'param2', get_string('hierarchicallevelcount', 'profilefield_hierarchicalmenu'), 'size="5"');
    $form->setType('param2', PARAM_INT);
    $form->setDefault('param2', $maxlevels);
    $form->addHelpButton('param2', 'hierarchicallevelcount', 'profilefield_hierarchicalmenu');

    // Setting: per-level labels (one per line).
    $form->addElement(
        'textarea',
        'param3',
        get_string('hierarchicallevellabels', 'profilefield_hierarchicalmenu'),
        ['rows' => max(3, $maxlevels), 'cols' => 40]
    );
    $form->setType('param3', PARAM_TEXT);
    $form->setDefault('param3', $displaylabels);
    if (isset($this->field)) {
        $this->field->param3 = $displaylabels;
    }
    $form->addHelpButton('param3', 'hierarchicallevellabels', 'profilefield_hierarchicalmenu');



    // Visual container for the hierarchical category manager (queda debajo ahora).
    $form->addElement('html', '<div id="hierarchical-category-manager" data-maxlevels="' . $maxlevels . '">
        <h4>' . get_string('hierarchicalcategories', 'profilefield_hierarchicalmenu') . '</h4>
        <div id="category-tree-container">
            <div id="category-tree"></div>
            <div class="category-controls">
                <button type="button" id="add-root-category" class="btn btn-primary">
                    ' . get_string('addrootcategory', 'profilefield_hierarchicalmenu') . '
                </button>
            </div>
        </div>
        <script>
            require([\'profilefield_hierarchicalmenu/category_manager\'], function(category_manager) {
                category_manager.init();
            });
        </script>
    </div>');
}

    /**
     * Validates data for the profile field.
     *
     * @param array $data
     * @param array $files
     * @return array
     */
    public function define_validate_specific($data, $files) {
        $err = array();

        // Convert stdClass to array if necessary
        if (is_object($data)) {
            $data = (array) $data;
        }

        $levelcount = $this->resolve_max_levels($data['param2'] ?? null);

        // Validate JSON structure for hierarchical categories
        if (!empty($data['param1'])) {
            $jsonData = trim($data['param1']);

            // Try to decode JSON
            $categoryData = json_decode($jsonData, true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                $err['param1'] = get_string('invalidjsonformat', 'profilefield_hierarchicalmenu');
            } else {
                // Validate structure
                if (!isset($categoryData['root']) || !isset($categoryData['root']['items'])) {
                    $err['param1'] = get_string('invalidjsonstructure', 'profilefield_hierarchicalmenu');
                } else {
                    // Validate hierarchy levels (max 3 levels)
                    $validationError = $this->validateHierarchyLevels($categoryData['root']['items'], 0, $levelcount);
                    if ($validationError) {
                        $err['param1'] = $validationError;
                    }

                    // Validate that we have at least one category if JSON is provided
                    if (empty($categoryData['root']['items'])) {
                        $err['param1'] = get_string('nocategoriesdefines', 'profilefield_hierarchicalmenu');
                    }
                }
            }
        }

        if (empty($data['param2']) || (int)$data['param2'] < 1) {
            $err['param2'] = get_string('invalidlevelcount', 'profilefield_hierarchicalmenu');
        }

        $labels = $this->parse_labels($data['param3'] ?? '');
        if (count($labels) < $levelcount) {
            $err['param3'] = get_string('invalidlevellabelcount', 'profilefield_hierarchicalmenu', $levelcount);
        }

        return $err;
    }
    
    /**
     * Validate hierarchy levels recursively
     *
     * @param array $items
     * @param int $currentLevel
     * @return string|null Error message or null if valid
     */
    private function validateHierarchyLevels($items, $currentLevel, $maxlevels) {
        if ($currentLevel >= $maxlevels) {
            return get_string('maxlevelexceeded', 'profilefield_hierarchicalmenu', $maxlevels);
        }

        foreach ($items as $item) {
            // Validate item structure
            if (!isset($item['name']) || empty(trim($item['name']))) {
                return get_string('emptycategoryname', 'profilefield_hierarchicalmenu');
            }

            // Validate children if they exist
            if (isset($item['childs']) && is_array($item['childs']) && !empty($item['childs'])) {
                $childError = $this->validateHierarchyLevels($item['childs'], $currentLevel + 1, $maxlevels);
                if ($childError) {
                    return $childError;
                }
            }
        }
        
        return null;
    }

    /**
     * Processes data before it is saved.
     * @param array|stdClass $data
     * @return array|stdClass
     */
    public function define_save_preprocess($data) {
        $data->param1 = str_replace("\r", '', $data->param1);

        $maxlevels = $this->resolve_max_levels($data->param2 ?? null);
        $data->param2 = $maxlevels;

        $labels = $this->parse_labels($data->param3 ?? '');
        if (count($labels) < $maxlevels) {
            $labels = array_merge($labels, $this->resolve_level_labels('', $maxlevels));
        }

        $data->param3 = json_encode(array_slice($labels, 0, $maxlevels), JSON_UNESCAPED_UNICODE);
        if ($data->param3 === false) {
            $data->param3 = json_encode($this->resolve_level_labels('', $maxlevels));
        }

        return $data;
    }

    /**
     * Resolve the configured maximum number of levels ensuring a sane default.
     *
     * @param mixed $raw
     * @return int
     */
    private function resolve_max_levels($raw) {
        $value = (int)$raw;
        if ($value < 1) {
            $value = 3;
        }

        return $value;
    }

    /**
     * Turn a raw label input into a trimmed array.
     *
     * @param string $raw
     * @return array
     */
    private function parse_labels($raw) {
        if (!is_string($raw) || $raw === '') {
            return [];
        }

        $parts = preg_split("/(\r\n|\r|\n)/", $raw);
        $parts = array_map('trim', $parts);
        $parts = array_filter($parts, static function($value) {
            return $value !== '';
        });

        return array_values($parts);
    }

    /**
     * Resolve the level labels filling with defaults as needed.
     *
     * @param string $raw
     * @param int $maxlevels
     * @return array
     */
    private function resolve_level_labels($raw, $maxlevels) {
        $labels = [];
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $labels = $decoded;
            } else {
                $labels = $this->parse_labels($raw);
            }
        }

        $labels = array_values($labels);
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

    /**
     * Convert stored labels into a newline separated string for form display.
     *
     * @param string $raw
     * @return string
     */
    private function prepare_labels_for_display($raw) {
        if (!is_string($raw) || $raw === '') {
            return '';
        }

        $decoded = json_decode($raw, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            $decoded = array_map(static function($value) {
                return trim((string)$value);
            }, $decoded);
            $decoded = array_filter($decoded, static function($value) {
                return $value !== '';
            });

            return implode("\n", $decoded);
        }

        // Normalise existing newline characters.
        return preg_replace("/(\r\n|\r)/", "\n", $raw);
    }
}
