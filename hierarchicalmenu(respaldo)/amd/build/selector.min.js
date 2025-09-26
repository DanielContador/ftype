/**
 * Cascading selector for hierarchical profile field (supports dynamic levels)
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
        if (!id) return []; // nothing selected
        return childrenOf[id] || [];
    }

    function preselect($sel, id) {
        if (id != null && id !== '') {
            $sel.val(String(id));
        }
    }

    function collectSelection(levels) {
        var selection = {};
        levels.forEach(function(l){
            selection[l.key] = l.$el.val() || '';
        });
        return selection;
    }

    function writeHidden($hidden, selection) {
        if (!$hidden.length) return;
        try {
            $hidden.val(JSON.stringify(selection));
        } catch (e) {
            $hidden.val('');
        }
    }

    function readInitialSelection(cfg, $hidden, levels) {
        var keys = levels.map(l => l.key);
        var blank = {};
        keys.forEach(k => blank[k] = '');

        function normalize(obj) {
            var out = {};
            keys.forEach(k => out[k] = (obj && obj[k] != null) ? String(obj[k]) : '');
            return out;
        }

        if (cfg.current && typeof cfg.current === 'object') {
            return normalize(cfg.current);
        }

        if ($hidden.length && $hidden.val()) {
            try {
                var parsed = JSON.parse($hidden.val());
                if (parsed && typeof parsed === 'object') {
                    return normalize(parsed);
                }
            } catch (e) {
                // Ignore invalid JSON
            }
        }

        return blank;
    }

    return {
        /**
         * @param {Object} cfg
         *  - root: {items: [...]}
         *  - fieldname: base input name, e.g. "profile_field_hierarchicalmenu_XX"
         *  - current: {levelX: id, ...} (optional)
         *  - hidden: hidden form element that stores JSON serialised selection
         *  - levels: [{key, placeholder}], dynamic depth
         */
        init: function(cfg) {
            var data = cfg.root || { items: [] };
            var byId = {}, childrenOf = {};
            indexById(data.items, byId, childrenOf);

            var levels = (cfg.levels || []).map(function(l){
                var name = cfg.fieldname + '[' + l.key + ']';
                return {
                    key: l.key,
                    placeholder: l.placeholder || 'Choose...',
                    $el: $('select[name="' + name + '"]')
                };
            });

            if (!levels.length) return;

            var $hidden = $('input[name="' + cfg.hidden + '"]');
            var initial = readInitialSelection(cfg, $hidden, levels);

            // Initial population
            populate(levels[0].$el, nodeListToOptions(data.items), levels[0].placeholder);
            preselect(levels[0].$el, initial[levels[0].key]);

            // populate subsequent levels based on initial selection
            for (var i = 1; i < levels.length; i++) {
                var parentVal = initial[levels[i-1].key] || '';
                var opts = parentVal ? findChildren(childrenOf, parentVal) : [];
                populate(levels[i].$el, nodeListToOptions(opts), levels[i].placeholder);
                preselect(levels[i].$el, initial[levels[i].key]);
            }

            writeHidden($hidden, collectSelection(levels));

            // Wire changes
            levels.forEach(function(level, idx){
                level.$el.on('change', function(){
                    // repopulate lower levels
                    for (var j = idx+1; j < levels.length; j++) {
                        var parentVal = levels[j-1].$el.val() || '';
                        var opts = parentVal ? findChildren(childrenOf, parentVal) : [];
                        populate(levels[j].$el, nodeListToOptions(opts), levels[j].placeholder);
                        preselect(levels[j].$el, levels[j].val());
                    }
                    writeHidden($hidden, collectSelection(levels));
                });
            });
        }
    };
});
