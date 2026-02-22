var myTheme = {
    init: function () {
        // Common functions
        if (this.inIframe()) $('body').addClass('in-iframe');
        if (!$('body').hasClass('exe-web-site')) return;
        // Add menu and search bar togglers
        var togglers =
            '\
            <button type="button" id="siteNavToggler" class="toggler" title="' +
            $exe_i18n.menu +
            '">\
                <span class="sr-av">' +
            $exe_i18n.menu +
            '</span>\
            </button>\
            <button type="button" id="searchBarTogger" class="toggler" title="' +
            $exe_i18n.search +
            '">\
                <span class="sr-av">' +
            $exe_i18n.search +
            '</span>\
            </button>\
        ';
        $('#siteNav').before(togglers);
        // Check the current NAV status
        var url = window.location.href;
        url = url.split('?');
        if (url.length > 1) {
            if (url[1].indexOf('nav=false') != -1) {
                $('body').addClass('siteNav-off');
                myTheme.params('add');
            }
        }
        // Menu toggler
        $('#siteNavToggler').on('click', function () {
            if (myTheme.isLowRes()) {
                $('#exe-client-search').hide();
                if ($('body').hasClass('siteNav-off')) {
                    $('body').removeClass('siteNav-off');
                } else {
                    if ($('#siteNav').isInViewport()) {
                        $('body').addClass('siteNav-off');
                        myTheme.params('add');
                    }
                }
            } else {
                $('body').toggleClass('siteNav-off');
                myTheme.params(
                    $('body').hasClass('siteNav-off') ? 'add' : 'remove'
                );
            }
        });
        // Search bar toggler
        $('#searchBarTogger').on('click', function () {
            var bar = $('#exe-client-search');
            if (bar.is(':visible')) {
                bar.hide();
            } else {
                if (myTheme.isLowRes()) {
                    $('body').addClass('siteNav-off');
                }
                bar.show();
                $('#exe-client-search-text').focus();
            }
        });
    },
    inIframe: function () {
        try {
            return window.self !== window.top;
        } catch (e) {
            return true;
        }
    },
    isLowRes: function () {
        return $('#siteNav').css('float') == 'none';
    },
    param: function (e, act) {
        if (act == 'add') {
            var ref = e.href;
            var con = '?';
            if (ref.indexOf('.html?') != -1) con = '&';
            var param = 'nav=false';
            if (ref.indexOf(param) == -1) {
                ref += con + param;
                e.href = ref;
            }
        } else {
            // This will remove all params
            var ref = e.href;
            ref = ref.split('?');
            e.href = ref[0];
        }
    },
    params: function (act) {
        $('.nav-buttons a').each(function () {
            myTheme.param(this, act);
        });
    }
};

$(function () {
    myTheme.init();
});

$.fn.isInViewport = function () {
    var elementTop = $(this).offset().top;
    var elementBottom = elementTop + $(this).outerHeight();
    var viewportTop = $(window).scrollTop();
    var viewportBottom = viewportTop + $(window).height();
    return elementBottom > viewportTop && elementTop < viewportBottom;
};
