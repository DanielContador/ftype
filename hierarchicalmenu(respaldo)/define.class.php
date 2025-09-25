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
        
        // Include CSS styles for the hierarchical category manager
        $PAGE->requires->css('/user/profile/field/hierarchicalmenu/styles.css');
        
        // Hidden textarea that will store the hierarchical categories in JSON format.
        $form->addElement('textarea', 'param1', get_string('profilemenuoptions', 'admin'), 
            array('rows' => 6, 'cols' => 40, 'style' => 'display: none;'));
        $form->setType('param1', PARAM_TEXT);
        
        // Visual container for the hierarchical category manager
        $form->addElement('html', '<div id="hierarchical-category-manager">
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
        
        // Default data.
        $form->addElement('text', 'defaultdata', get_string('profiledefaultdata', 'admin'), 'size="50"');
        $form->setType('defaultdata', PARAM_TEXT);
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
                    $validationError = $this->validateHierarchyLevels($categoryData['root']['items'], 0);
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

        return $err;
    }
    
    /**
     * Validate hierarchy levels recursively
     *
     * @param array $items
     * @param int $currentLevel
     * @return string|null Error message or null if valid
     */
    private function validateHierarchyLevels($items, $currentLevel) {
        if ($currentLevel >= 3) {
            return get_string('maxlevelexceeded', 'profilefield_hierarchicalmenu');
        }
        
        foreach ($items as $item) {
            // Validate item structure
            if (!isset($item['name']) || empty(trim($item['name']))) {
                return get_string('emptycategoryname', 'profilefield_hierarchicalmenu');
            }
            
            // Validate children if they exist
            if (isset($item['childs']) && is_array($item['childs']) && !empty($item['childs'])) {
                $childError = $this->validateHierarchyLevels($item['childs'], $currentLevel + 1);
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

        return $data;
    }

}
