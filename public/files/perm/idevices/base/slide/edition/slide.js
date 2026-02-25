/**
 * Slide iDevice — edition bridge for tldraw.
 *
 * Dynamically loads the pre-built tldraw bundle and mounts the React editor
 * into the iDevice container, implementing the $exeDevice.init/save contract.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning — https://exelearning.net
 * License: https://creativecommons.org/licenses/by-sa/4.0/
 */

/* global _, eXeLearning */
/* eslint-disable no-undef */

(function () {
    'use strict';

    var BUNDLE_GLOBAL = '__slideEditorInit';
    var BUNDLE_FILE   = 'slide-editor.bundle.js';

    /**
     * Load the tldraw bundle script if not already present.
     * Memoizes the Promise so multiple concurrent inits share one request.
     *
     * @param {string} idevicePath  Base path to the iDevice edition/ folder
     * @returns {Promise<void>}
     */
    function loadBundle(idevicePath) {
        if (window[BUNDLE_GLOBAL]) { return Promise.resolve(); }
        if (window.__slideBundlePromise) { return window.__slideBundlePromise; }

        window.__slideBundlePromise = new Promise(function (resolve, reject) {
            var script    = document.createElement('script');
            script.type   = 'text/javascript';
            script.src    = idevicePath + BUNDLE_FILE;
            script.onload = resolve;
            script.onerror = function (err) {
                delete window.__slideBundlePromise;
                reject(err);
            };
            document.head.appendChild(script);
        });

        return window.__slideBundlePromise;
    }

    window.$exeDevice = {
        _editorApi: null,
        _ideviceId: null,

        /**
         * Called by eXeLearning when the iDevice is opened for editing.
         *
         * @param {HTMLElement} element       Container element
         * @param {*}           previousData  Previously saved JSON (or null)
         * @param {string}      path          URL path to the iDevice edition folder
         */
        init: function (element, previousData, path) {
            var self = this;
            self._editorApi = null;
            self._ideviceId = element.getAttribute('idevice-id');
            element.classList.add('slide-editor-tldraw-host');

            // Always start from a clean container so any previous React root
            // (which was mounted into a child wrapper, not element itself) is
            // removed from the DOM before we create a new one.
            element.innerHTML = '';

            var loadingEl = document.createElement('div');
            loadingEl.className = 'slide-loading';
            loadingEl.textContent = _('Loading editor\u2026');
            element.appendChild(loadingEl);

            loadBundle(path)
                .then(function () {
                    // Remove loading indicator and mount React into a fresh wrapper.
                    // Using a new wrapper div each time means createRoot() always
                    // receives a never-before-used element — no stale root issues.
                    element.innerHTML = '';
                    var wrapper = document.createElement('div');
                    wrapper.style.cssText = 'width:100%;height:100%';
                    element.appendChild(wrapper);

                    var yjsBridge = (
                        window.eXeLearning &&
                        window.eXeLearning.app &&
                        window.eXeLearning.app.project &&
                        window.eXeLearning.app.project._yjsBridge
                    ) || null;

                    self._editorApi = window[BUNDLE_GLOBAL].mount(wrapper, {
                        previousData: previousData,
                        ideviceId:   self._ideviceId,
                        yjsBridge:   yjsBridge,
                        bundlePath:  path,
                    });
                })
                .catch(function () {
                    element.innerHTML = '';
                    var errEl = document.createElement('p');
                    errEl.className = 'slide-error';
                    errEl.textContent = _('Could not load the slide editor. Please reload the page.');
                    element.appendChild(errEl);
                });
        },

        /**
         * Called by eXeLearning when saving the iDevice.
         * Returns version-2 JSON with tldraw store snapshot and cached SVG.
         *
         * @returns {{ ideviceId: string, version: 2, store: object, svg: string } | null}
         */
        save: function () {
            if (!this._editorApi) { return null; }
            return {
                ideviceId: this._ideviceId,
                version:   2,
                store:     this._editorApi.getStoreSnapshot(),
                svg:       this._editorApi.getSvgString(),
            };
        },
    };
}());
