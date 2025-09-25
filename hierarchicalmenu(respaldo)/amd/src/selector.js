/**
 * Cascading selector for hierarchical profile field
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
        if (!id) return;
        $sel.val(id);
    }

    return {
        /**
         * @param {Object} cfg
         *  - root: {items: [...]}
         *  - fieldname: base input name, e.g. "profile_field_hierarchicalmenu_XX"
         *  - current: {level0, level1, level2} ids (optional)
         *  - labels: {l0, l1, l2} (optional)
         */
        init: function(cfg) {
            var data = cfg.root || { items: [] };
            var byId = {}, childrenOf = {};
            indexById(data.items, byId, childrenOf);

            var name0 = cfg.fieldname + '[level0]';
            var name1 = cfg.fieldname + '[level1]';
            var name2 = cfg.fieldname + '[level2]';

            var $l0 = $('select[name="' + name0 + '"]');
            var $l1 = $('select[name="' + name1 + '"]');
            var $l2 = $('select[name="' + name2 + '"]');

            // Initial population
            populate($l0, nodeListToOptions(data.items), (cfg.labels && cfg.labels.l0) || 'Choose...');
            populate($l1, [], (cfg.labels && cfg.labels.l1) || 'Choose...');
            populate($l2, [], (cfg.labels && cfg.labels.l2) || 'Choose...');

            // Preselect if we have saved ids
            if (cfg.current) {
                preselect($l0, cfg.current.level0 || '');
                var lvl1 = findChildren(childrenOf, cfg.current.level0 || '');
                populate($l1, nodeListToOptions(lvl1), (cfg.labels && cfg.labels.l1) || 'Choose...');
                preselect($l1, cfg.current.level1 || '');

                var lvl2 = findChildren(childrenOf, cfg.current.level1 || '');
                populate($l2, nodeListToOptions(lvl2), (cfg.labels && cfg.labels.l2) || 'Choose...');
                preselect($l2, cfg.current.level2 || '');
            }

            // Wiring changes
            $l0.on('change', function(){
                var id0 = $l0.val() || '';
                var lvl1 = findChildren(childrenOf, id0);
                populate($l1, nodeListToOptions(lvl1), (cfg.labels && cfg.labels.l1) || 'Choose...');
                populate($l2, [], (cfg.labels && cfg.labels.l2) || 'Choose...');
            });

            $l1.on('change', function(){
                var id1 = $l1.val() || '';
                var lvl2 = findChildren(childrenOf, id1);
                populate($l2, nodeListToOptions(lvl2), (cfg.labels && cfg.labels.l2) || 'Choose...');
            });
        }
    };
});
