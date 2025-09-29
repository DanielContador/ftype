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

    function buildBlankSelection(keys) {
        var blank = {};
        keys.forEach(function(key){
            blank[key] = '';
        });
        return blank;
    }

    function normaliseFromObject(obj, keys) {
        var blank = buildBlankSelection(keys);
        if (!obj || typeof obj !== 'object') {
            return blank;
        }

        var out = $.extend({}, blank);
        keys.forEach(function(key){
            if (obj[key] != null) {
                out[key] = String(obj[key]);
            }
        });

        return out;
    }

    function readHiddenSelection($hidden, keys) {
        if (!$hidden.length || !$hidden.val()) {
            return buildBlankSelection(keys);
        }

        try {
            var parsed = JSON.parse($hidden.val());
            return normaliseFromObject(parsed, keys);
        } catch (e) {
            return buildBlankSelection(keys);
        }
    }

    function resolveLeafSelection(map, blank, keys, leafkey, leafId, fallback) {
        var id = leafId != null ? String(leafId) : '';
        var selection = $.extend({}, blank);

        if (!id) {
            return selection;
        }

        if (Object.prototype.hasOwnProperty.call(map, id)) {
            var mapped = map[id] || {};
            keys.forEach(function(key){
                if (mapped[key] != null) {
                    selection[key] = String(mapped[key]);
                }
            });
            return selection;
        }

        if (fallback && fallback[leafkey] === id) {
            return $.extend(selection, fallback);
        }

        return selection;
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

    function annotateOptionsWithLabels($select, labels) {
        if (!$select.length || !labels) {
            return;
        }

        $select.find('option').each(function(){
            var $option = $(this);
            var value = $option.attr('value');
            if (!Object.prototype.hasOwnProperty.call(labels, value)) {
                $option.removeAttr('data-full-label');
                return;
            }

            var full = labels[value];
            if (typeof full !== 'string' || full.trim() === '') {
                $option.removeAttr('data-full-label');
                return;
            }

            $option.attr('data-full-label', full);
        });
    }

    function attachTooltipBehaviour($select) {
        if (!$select.length) {
            return;
        }

        var tooltip = null;
        var activeValue = null;
        var lastCoords = null;
        var timer = null;

        function ensureTooltip() {
            if (tooltip && tooltip.length && tooltip.closest('body').length) {
                return tooltip;
            }
            tooltip = $('<div>', {
                'class': 'hierarchicalmenu-tooltip',
                'role': 'tooltip',
                'aria-hidden': 'true'
            });
            $('body').append(tooltip);
            return tooltip;
        }

        function hideTooltip() {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            activeValue = null;
            lastCoords = null;
            if (tooltip && tooltip.length) {
                tooltip.removeClass('visible').attr('aria-hidden', 'true');
            }
        }

        function defaultCoordinates() {
            var rect = $select[0].getBoundingClientRect();
            return {
                pageX: rect.left + window.pageXOffset + rect.width / 2,
                pageY: rect.top + window.pageYOffset + rect.height
            };
        }

        function resolveCoordinates(coordinates) {
            if (coordinates && typeof coordinates.pageX === 'number' && typeof coordinates.pageY === 'number') {
                return coordinates;
            }
            if (lastCoords && typeof lastCoords.pageX === 'number' && typeof lastCoords.pageY === 'number') {
                return lastCoords;
            }
            return defaultCoordinates();
        }

        function showTooltip($option, coordinates) {
            var fullText = $option.attr('data-full-label');
            var displayText = $option.text();

            if (!fullText || !displayText || fullText === displayText.trim()) {
                hideTooltip();
                return;
            }

            var value = $option.attr('value');
            activeValue = value;
            lastCoords = resolveCoordinates(coordinates);

            var tip = ensureTooltip();
            tip.text(fullText)
                .css({
                    left: lastCoords.pageX + 12,
                    top: lastCoords.pageY + 12
                })
                .addClass('visible')
                .attr('aria-hidden', 'false');
        }

        function optionFromEvent(event) {
            if (event && event.target && event.target.tagName === 'OPTION') {
                return event.target;
            }
            var selected = $select.find('option:selected');
            return selected.length ? selected[0] : null;
        }

        function maybeShowTooltip(optionEl, coordinates) {
            if (!optionEl) {
                hideTooltip();
                return;
            }

            var $option = $(optionEl);
            var value = $option.attr('value');

            if (activeValue === value && tooltip && tooltip.hasClass('visible')) {
                lastCoords = resolveCoordinates(coordinates);
                tooltip.css({
                    left: lastCoords.pageX + 12,
                    top: lastCoords.pageY + 12
                });
                return;
            }

            if (timer) {
                clearTimeout(timer);
                timer = null;
            }

            timer = setTimeout(function() {
                showTooltip($option, coordinates);
            }, 300); // small delay for better UX
        }

        $select.on('mousemove.hierarchicalmenuTooltip', function(event){
            lastCoords = { pageX: event.pageX, pageY: event.pageY };
            maybeShowTooltip(optionFromEvent(event), lastCoords);
        });

        $select.on('mouseenter.hierarchicalmenuTooltip focus.hierarchicalmenuTooltip', function(event){
            lastCoords = resolveCoordinates({ pageX: event.pageX, pageY: event.pageY });
            maybeShowTooltip(optionFromEvent(event), lastCoords);
        });

        $select.on('change.hierarchicalmenuTooltip input.hierarchicalmenuTooltip', function(event){
            maybeShowTooltip(optionFromEvent(event), resolveCoordinates({ pageX: event.pageX, pageY: event.pageY }));
        });

        $select.on('mouseleave.hierarchicalmenuTooltip blur.hierarchicalmenuTooltip', function(){
            hideTooltip();
        });

        $(document).on('scroll.hierarchicalmenuTooltip', hideTooltip);

        $select.data('hierarchicalmenuTooltipCleanup', function(){
            hideTooltip();
            if (tooltip && tooltip.length) {
                tooltip.remove();
            }
            $(document).off('scroll.hierarchicalmenuTooltip', hideTooltip);
            $select.off('.hierarchicalmenuTooltip');
            $select.removeData('hierarchicalmenuTooltipCleanup');
        });
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
        },
        /**
         * Initialiser for the simplified single-leaf selector.
         *
         * @param {Object} cfg
         *  - hidden: name of the hidden input storing JSON selection
         *  - leafkey: key representing the final level (e.g. level3)
         *  - leafname: name attribute of the visible select element
         *  - leafmap: mapping of leaf option id => {level0: id, level1: id, ...}
         *  - levelkeys: ordered list of hierarchy keys
         */
        initLeaf: function(cfg) {
            var keys = Array.isArray(cfg.levelkeys) ? cfg.levelkeys.slice() : [];
            var blank = buildBlankSelection(keys);
            var leafkey = cfg.leafkey || (keys.length ? keys[keys.length - 1] : 'leaf');
            var map = cfg.leafmap || {};

            var $select = $('select[name="' + cfg.leafname + '"]');
            var $hidden = $('input[name="' + cfg.hidden + '"]');

            if (!$select.length || !$hidden.length) {
                return;
            }

            if (cfg.leaflabels && typeof cfg.leaflabels === 'object') {
                annotateOptionsWithLabels($select, cfg.leaflabels);
                attachTooltipBehaviour($select);
            }

            var fallback = readHiddenSelection($hidden, keys);
            var initialLeaf = fallback[leafkey] || $select.val() || '';

            if (initialLeaf) {
                $select.val(String(initialLeaf));
            } else {
                $select.val('');
            }

            function syncHidden(leafId) {
                var selection = resolveLeafSelection(map, blank, keys, leafkey, leafId, fallback);
                writeHidden($hidden, selection);
                fallback = selection;
            }

            syncHidden($select.val() || '');

            $select.on('change', function(){
                syncHidden($(this).val() || '');
            });

            $select.on('remove', function(){
                var cleanup = $select.data('hierarchicalmenuTooltipCleanup');
                if (typeof cleanup === 'function') {
                    cleanup();
                }
            });
        }
    };
});
