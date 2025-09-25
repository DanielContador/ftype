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

        MAX_LEVELS: 3,

        // Data structure: { root: { items: [ { id, name, childs: [...] }, ... ] } }
        categoryData: { root: { items: [] } },

        init: function() {
            var self = this;
            $(document).ready(function() {
                self.bindEvents();
                self.loadExistingData();
                // Ensure every node has a stable id (for profile selection later)
                self.ensureIds(self.categoryData.root.items);
                self.saveData();
                self.renderTree();
            });
        },

        bindEvents: function() {
            var self = this;

            $('#add-root-category').off('click').on('click', function(e) {
                e.preventDefault();
                self.showAddCategoryModal(null, 0, null);
            });

            // Delegated handlers in the tree
            $('#category-tree').off('click')
                .on('click', '.add-subcategory', function(e) {
                    e.preventDefault();
                    var path = $(this).data('path');      // path like "0-2"
                    var level = parseInt($(this).data('level'));
                    self.showAddCategoryModal(path, level + 1, null);
                })
                .on('click', '.edit-category', function(e) {
                    e.preventDefault();
                    var path = $(this).data('path');
                    self.showEditCategoryModal(path);
                })
                .on('click', '.delete-category', function(e) {
                    e.preventDefault();
                    var path = $(this).data('path');
                    self.showDeleteConfirmation(path);
                });
        },

        loadExistingData: function() {
            var jsonData = $('textarea[name="param1"]').val();
            if (jsonData && jsonData.trim() !== '') {
                try {
                    var parsed = JSON.parse(jsonData);
                    if (parsed && parsed.root && Array.isArray(parsed.root.items)) {
                        this.categoryData = parsed;
                        return;
                    }
                } catch (e) {
                    // fall-through to reset
                }
            }
            this.categoryData = { root: { items: [] } };
        },

        saveData: function() {
            $('textarea[name="param1"]').val(JSON.stringify(this.categoryData));
        },

        /* ----------------- rendering ----------------- */

        renderTree: function() {
            var $container = $('#category-tree').empty();
            if (!this.categoryData.root.items.length) {
                $container.html('<p class="text-muted">No categories defined yet. Click "Add Root Category" to start.</p>');
                return;
            }
            var html = this.renderTreeLevel(this.categoryData.root.items, 0, '');
            $container.html('<ul class="category-tree-root">' + html + '</ul>');
        },

        // Render items at a level. `basePath` is the index path to this array ('' for root).
        renderTreeLevel: function(items, level, basePath) {
            var self = this, html = '';
            items.forEach(function(item, index) {
                var path = basePath === '' ? String(index) : basePath + '-' + index;
                var hasChildren = Array.isArray(item.childs) && item.childs.length > 0;
                var canAddChildren = level < (self.MAX_LEVELS - 1);

                html += '<li class="category-item level-' + level + '" data-path="' + path + '">';
                html += '  <div class="category-content">';
                html += '    <span class="category-name">' + self.escapeHtml(item.name) + '</span>';
                html += '    <div class="category-actions">';

                if (canAddChildren) {
                    html += '      <button type="button" class="btn btn-sm btn-outline-primary add-subcategory" ' +
                            'data-path="' + path + '" data-level="' + level + '" title="Add Subcategory">+ Sub</button>';
                }

                html += '      <button type="button" class="btn btn-sm btn-outline-secondary edit-category" ' +
                        'data-path="' + path + '" title="Edit Category">Edit</button>';

                html += '      <button type="button" class="btn btn-sm btn-outline-danger delete-category" ' +
                        'data-path="' + path + '" title="Delete Category">Delete</button>';

                html += '    </div>';
                html += '  </div>';

                if (hasChildren) {
                    html += '  <ul class="category-children">';
                    html +=        self.renderTreeLevel(item.childs, level + 1, path);
                    html += '  </ul>';
                }

                html += '</li>';
            });
            return html;
        },

        /* ----------------- modals ----------------- */

        showAddCategoryModal: function(parentPath, level) {
            var self = this;
            if (level >= this.MAX_LEVELS) {
                alert('Maximum nesting level (3) reached. Cannot add more subcategories.');
                return;
            }
            var title = level === 0 ? 'Add Root Category' : 'Add Subcategory';
            ModalFactory.create({
                type: ModalFactory.types.SAVE_CANCEL,
                title: title,
                body:
                    '<div class="form-group">' +
                    '  <label for="category-name-input">Category Name:</label>' +
                    '  <input type="text" id="category-name-input" class="form-control" placeholder="Enter category name">' +
                    '</div>'
            }).then(function(modal) {
                modal.getRoot().on(ModalEvents.save, function(e) {
                    e.preventDefault();
                    var name = modal.getRoot().find('#category-name-input').val().trim();
                    if (!name) { alert('Category name cannot be empty.'); return; }
                    self.addCategory(parentPath, name);
                    modal.destroy();
                });
                modal.getRoot().on(ModalEvents.cancel, function() { modal.destroy(); });
                modal.show();
                modal.getRoot().on(ModalEvents.shown, function() {
                    modal.getRoot().find('#category-name-input').focus();
                });
            }).catch(function(err){ console.error('Error creating modal:', err); });
        },

        showEditCategoryModal: function(path) {
            var self = this;
            var cat = this.findCategoryByPath(path);
            if (!cat) { console.error('Category not found:', path); return; }

            ModalFactory.create({
                type: ModalFactory.types.SAVE_CANCEL,
                title: 'Edit Category',
                body:
                    '<div class="form-group">' +
                    '  <label for="category-name-input">Category Name:</label>' +
                    '  <input type="text" id="category-name-input" class="form-control" value="' + this.escapeHtml(cat.name) + '">' +
                    '</div>'
            }).then(function(modal) {
                modal.getRoot().on(ModalEvents.save, function(e) {
                    e.preventDefault();
                    var name = modal.getRoot().find('#category-name-input').val().trim();
                    if (!name) { alert('Category name cannot be empty.'); return; }
                    self.editCategory(path, name);
                    modal.destroy();
                });
                modal.getRoot().on(ModalEvents.cancel, function(){ modal.destroy(); });
                modal.show();
                modal.getRoot().on(ModalEvents.shown, function() {
                    modal.getRoot().find('#category-name-input').focus().select();
                });
            }).catch(function(err){ console.error('Error creating edit modal:', err); });
        },

        showDeleteConfirmation: function(path) {
            var self = this;
            if (confirm('Are you sure you want to delete this category and all its subcategories?')) {
                self.deleteCategory(path);
            }
        },

        /* ----------------- CRUD ----------------- */

        addCategory: function(parentPath, name) {
            var node = { id: this.generateId(), name: name, childs: [] };
            if (parentPath === null) {
                this.categoryData.root.items.push(node);
            } else {
                var parent = this.findCategoryByPath(parentPath);
                if (!parent) { console.error('Parent not found for path', parentPath); return; }
                parent.childs = parent.childs || [];
                parent.childs.push(node);
            }
            this.saveData();
            this.renderTree();
        },

        editCategory: function(path, newName) {
            var category = this.findCategoryByPath(path);
            if (!category) { console.error('Category not found for edit:', path); return; }
            category.name = newName;
            this.saveData();
            this.renderTree();
        },

        deleteCategory: function(path) {
            if (this.removeCategoryByPath(path)) {
                this.saveData();
                this.renderTree();
            } else {
                console.error('Failed to delete category:', path);
            }
        },

        /* ----------------- helpers ----------------- */

        // Find by path like "2-0-1"
        findCategoryByPath: function(path) {
            var parts = String(path).split('-').map(function(p){ return parseInt(p, 10); });
            var current = this.categoryData.root.items;
            for (var i = 0; i < parts.length; i++) {
                var idx = parts[i];
                if (!Array.isArray(current) || idx < 0 || idx >= current.length) return null;
                var node = current[idx];
                if (i === parts.length - 1) return node;
                current = node.childs;
            }
            return null;
        },

        removeCategoryByPath: function(path) {
            var parts = String(path).split('-').map(function(p){ return parseInt(p, 10); });
            var arr = this.categoryData.root.items;
            for (var i = 0; i < parts.length - 1; i++) {
                var idx = parts[i];
                if (!Array.isArray(arr) || idx < 0 || idx >= arr.length) return false;
                arr = arr[idx].childs;
            }
            var finalIdx = parts[parts.length - 1];
            if (!Array.isArray(arr) || finalIdx < 0 || finalIdx >= arr.length) return false;
            arr.splice(finalIdx, 1);
            return true;
        },

        // Ensure every node has a stable id
        ensureIds: function(items) {
            var self = this;
            (items || []).forEach(function(n){
                if (!n.id) n.id = self.generateId();
                if (!Array.isArray(n.childs)) n.childs = [];
                self.ensureIds(n.childs);
            });
        },

        // Simple random-ish ID (stable within saved JSON)
        generateId: function() {
            return 'n_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        },

        escapeHtml: function(text) {
            var div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    };

    return CategoryManager;
});
