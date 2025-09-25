/**
 * Cascading selector for hierarchical profile field (dynamic depth)
 * @module profilefield_hierarchicalmenu/selector
 */
define(['jquery'], function($) {

    function indexById(items, byId, childrenOf) {
        (items || []).forEach(function(n){
            byId[n.id] = n;
            childrenOf[n.id] = n.childs || [];
            indexById(n.childs || [], byId, childrenOf);
        });
    }

    function populate($sel, options, placeholder) {
        $sel.empty();
        if (placeholder) {
            $sel.append($('<option>').attr('value', '').text(placeholder));
        }
        options.forEach(function(o){
            $sel.append($('<option>').attr('value', o.id).text(o.name));
        });
        $sel.trigger('change.select2'); // harmless if select2 not present
    }

    function nodeListToOptions(nodes) {
        return (nodes || []).map(function(n){ return { id: n.id, name: n.name }; });
    }

    function findChildren(childrenOf, id) {
        if (!id) return [];
        return childrenOf[id] || [];
    }

    function preselect($sel, id) {
        if (id === undefined || id === null || id === '') {
            return;
        }
        $sel.val(String(id));
    }

    function collectSelection(levels) {
        var selection = {};
        levels.forEach(function(level) {
            selection[level.key] = level.$el.val() || '';
        });
        return selection;
    }

    function writeHidden($hidden, selection) {
        if (!$hidden.length) {
            return;
        }
        try {
            $hidden.val(JSON.stringify(selection));
        } catch (e) {
            $hidden.val('');
        }
    }

    function readInitialSelection(cfg, $hidden) {
        var keys = (cfg.levels || []).map(function(level) { return level.key; });
        var base = {};
        keys.forEach(function(key) { base[key] = ''; });

        function normalise(source) {
            if (!source || typeof source !== 'object') {
                return null;
            }
            var result = {};
            keys.forEach(function(key) {
                if (Object.prototype.hasOwnProperty.call(source, key) &&
                    source[key] !== null && source[key] !== undefined) {
                    result[key] = String(source[key]);
                } else {
                    result[key] = '';
                }
            });
            return result;
        }

        var initial = normalise(cfg.current);

        if (!initial && $hidden.length && $hidden.val()) {
            try {
                var parsed = JSON.parse($hidden.val());
                initial = normalise(parsed);
            } catch (e) {
                initial = null;
            }
        }

        return initial || base;
    }

    return {
        /**
         * @param {Object} cfg
         *  - root: {items: [...]}
         *  - fieldname: base input name, e.g. "profile_field_hierarchicalmenu_XX"
         *  - current: {levelX: value, ...} ids (optional)
         *  - hidden: hidden form element that stores JSON serialised selection
         *  - levels: [{key, placeholder}] describing each cascading level
         */
        init: function(cfg) {
            var data = cfg.root || { items: [] };
            var byId = {}, childrenOf = {};
            indexById(data.items, byId, childrenOf);

            var levelConfigs = (cfg.levels || []).map(function(level) {
                return {
                    key: level.key,
                    placeholder: level.placeholder || 'Choose...'
                };
            });

            if (!levelConfigs.length) {
                return;
            }

            var levels = levelConfigs.map(function(levelCfg) {
                var name = cfg.fieldname + '[' + levelCfg.key + ']';
                return {
                    key: levelCfg.key,
                    placeholder: levelCfg.placeholder,
                    $el: $('select[name="' + name + '"]')
                };
            });

            var placeholders = levelConfigs.map(function(levelCfg) {
                return levelCfg.placeholder || 'Choose...';
            });

            var $hidden = $('input[name="' + cfg.hidden + '"]');
            var initial = readInitialSelection(cfg, $hidden);

            // Populate root level.
            populate(levels[0].$el, nodeListToOptions(data.items), placeholders[0]);
            preselect(levels[0].$el, initial[levelConfigs[0].key]);

            // Populate subsequent levels based on initial selection.
            for (var i = 1; i < levels.length; i++) {
                var parentKey = levelConfigs[i - 1].key;
                var parentId = initial[parentKey] || '';
                var children = parentId ? nodeListToOptions(findChildren(childrenOf, parentId)) : [];
                populate(levels[i].$el, children, placeholders[i]);
                preselect(levels[i].$el, initial[levelConfigs[i].key]);
            }

            writeHidden($hidden, collectSelection(levels));

            // Wiring changes
            levels.forEach(function(level, index) {
                level.$el.on('change', function() {
                    for (var i = index + 1; i < levels.length; i++) {
                        var parentVal = levels[i - 1].$el.val() || '';
                        var nodes = parentVal ? nodeListToOptions(findChildren(childrenOf, parentVal)) : [];
                        populate(levels[i].$el, nodes, placeholders[i]);
                    }
                    writeHidden($hidden, collectSelection(levels));
                });
            });
        }
    };
});
