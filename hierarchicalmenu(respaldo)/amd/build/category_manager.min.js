/**
 * Hierarchical Category Manager AMD module
 *
 * @module     profilefield_hierarchicalmenu/category_manager
 * @copyright  2024 DL Company
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define(['jquery', 'core/str', 'core/modal_factory', 'core/modal_events'],
function($, Str, ModalFactory, ModalEvents) {

    var CategoryManager = {

        maxLevels: 3,

        // Data structure: { root: { items: [ { id, name, childs: [...] }, ... ] } }
        categoryData: { root: { items: [] } },

        init: function() {
            var self = this;
            $(document).ready(function() {
                var manager = $('#hierarchical-category-manager');
                if (!manager.length) {
                    return; // ✅ From fix branch: bail early if manager not present
                }

                // ✅ From fix branch: mount the field settings UI
                self.mountLevelSettings(manager);

                var configuredLevels = parseInt(manager.data('maxlevels'), 10);
                if (!isNaN(configuredLevels) && configuredLevels > 0) {
                    self.maxLevels = configuredLevels;
                }
                self.bindEvents();
                self.loadExistingData();
                // Ensure every node has a stable id (for profile selection later)
                self.ensureIds(self.categoryData.root.items);
                self.saveData();
                self.renderTree();
            });
        },

        mountLevelSettings: function($manager) {
            var $host = $manager.find('.category-manager-settings');
            if (!$host.length) {
                return;
            }

            var $levelCount = $('#fitem_id_param2');
            if (!$levelCount.length) {
                $levelCount = $('input[name="param2"]').closest('.form-group');
            }
            if (!$levelCount.length) {
                $levelCount = $('input[name="param2"]').closest('.fitem');
            }

            var $levelLabels = $('#fitem_id_param3');
            if (!$levelLabels.length) {
                $levelLabels = $('textarea[name="param3"]').closest('.form-group');
            }
            if (!$levelLabels.length) {
                $levelLabels = $('textarea[name="param3"]').closest('.fitem');
            }

            if ($levelCount.length) {
                $host.append($levelCount);
            }
            if ($levelLabels.length) {
                $host.append($levelLabels);
            }
        },

        // ... rest of the file unchanged ...
    };

    return CategoryManager;
});
