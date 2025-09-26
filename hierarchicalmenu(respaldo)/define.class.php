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
        $labels = $this->resolve_level_labels($this->field->param3 ?? '', $maxlevels);

        // Hidden textarea that will store the hierarchical categories in JSON format.
        $form->addElement('textarea', 'param1', get_string('profilemenuoptions', 'admin'),
            ['rows' => 6, 'cols' => 40, 'style' => 'display: none;']);
        $form->setType('param1', PARAM_TEXT);

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
        $form->setDefault('param3', implode("\n", $labels));
        $form->addHelpButton('param3', 'hierarchicallevellabels', 'profilefield_hierarchicalmenu');

        // Visual container for the hierarchical category manager.
        $form->addElement('html', '<div id="hierarchical-category-manager" data-maxlevels="' . $maxlevels . '">
            <h4>' . get_string('hierarchicalcategories', 'profilefield_hierarchicalmenu') . '</h4>
            <div class="category-manager-settings"></div>
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

    // ... rest of the class unchanged ...
}
