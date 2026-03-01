const WEBMCP_DOCS_URL =
    'https://github.com/exelearning/exelearning/blob/main/doc/webmcp.md';
const WEBMCP_LOCAL_SCRIPT_PATH = 'libs/webmcp/webmcp.js';
const WEBMCP_ROOT_SCRIPT_PATH = 'webmcp.js';
const WEBMCP_FALLBACK_REMOTE_SCRIPT_URLS = [
    'https://webmcp.dev/src/webmcp.js',
    'https://cdn.jsdelivr.net/npm/@jason.today/webmcp@latest/build/webmcp.js',
    'https://unpkg.com/@jason.today/webmcp@latest/build/webmcp.js',
];
const AZ_QUIZ_DEFAULT_MESSAGES = {
    msgReady: 'Ready?',
    msgStartGame: 'Click here to start',
    msgHappen: 'Move on',
    msgReply: 'Reply',
    msgSubmit: 'Submit',
    msgEnterCode: 'Enter the access code',
    msgErrorCode: 'The access code is not correct',
    msgGameOver: 'Game Over!',
    msgNewWord: 'New word',
    msgStartWith: 'Starts with %1',
    msgContaint: 'Contains letter %1',
    msgPass: 'Move on to the next word',
    msgIndicateWord: 'Provide a word',
    msgClue: 'Cool! The clue is:',
    msgNewGame: 'Click here for a new game',
    msgYouHas: 'You have got %1 hits and %2 misses',
    msgCodeAccess: 'Access code',
    msgPlayAgain: 'Play Again',
    msgRequiredAccessKey: 'Access code required',
    msgInformationLooking: 'The information you were looking for',
    msgPlayStart: 'Click here to play',
    msgMinimize: 'Minimize',
    msgMaximize: 'Maximize',
    msgHits: 'Hits',
    msgErrors: 'Errors',
    msgTime: 'Time Limit (mm:ss)',
    msgOneRound: 'One round',
    msgTowRounds: 'Two rounds',
    msgImage: 'Image',
    msgNoImage: 'No image',
    msgWrote: 'Write the correct word and click on Reply. If you hesitate, click on Move on.',
    msgNotNetwork: 'You can only play this game with internet connection.',
    msgSuccesses: 'Right! | Excellent! | Great! | Very good! | Perfect!',
    msgFailures: 'It was not that! | Incorrect! | Not correct! | Sorry! | Error!',
    msgEndGameScore: 'Please start the game before saving your score.',
    msgScoreScorm:
        "The score can't be saved because this page is not part of a SCORM package.",
    msgShowRoulette: 'Show word wheel',
    msgHideRoulette: 'Hide word wheel',
    msgQuestion: 'Question',
    msgAnswer: 'Answer',
    msgOnlySaveScore: 'You can only save the score once!',
    msgOnlySave: 'You can only save once',
    msgInformation: 'Information',
    msgYouScore: 'Your score',
    msgOnlySaveAuto:
        'Your score will be saved after each question. You can only play once.',
    msgSaveAuto:
        'Your score will be automatically saved after each question.',
    msgAuthor: 'Authorship',
    msgSeveralScore: 'You can save the score as many times as you want',
    msgYouLastScore: 'The last score saved is',
    msgActityComply: 'You have already done this activity.',
    msgPlaySeveralTimes: 'You can do this activity as many times as you want',
    msgFullScreen: 'Full Screen',
    msgExitFullScreen: 'Exit Full Screen',
    msgMoveOne: 'Move on',
    msgAudio: 'Audio',
    msgCorrect: 'Correct',
    msgIncorrect: 'Incorrect',
    msgWhiteBoard: 'Digital whiteboard',
    msgClose: 'Close',
    msgUncompletedActivity: 'Incomplete activity',
    msgSuccessfulActivity: 'Activity: Passed. Score: %s',
    msgUnsuccessfulActivity: 'Activity: Not passed. Score: %s',
    msgTypeGame: 'A-Z quiz',
    msgShowWords: 'Show solutions',
    msgAll: 'All',
    msgUnanswered: 'Not answered',
    msgScore: 'Score',
    msgWeight: 'Weight',
};
const AZ_QUIZ_DEFAULT_INSTRUCTIONS =
    'Observe the letters, identify and fill in the missing words.';
const AZ_QUIZ_DEFAULT_NOT_SUPPORTED_BROWSER_MESSAGE =
    'Your browser is not compatible with this tool.';

export default class WebMCPService {
    constructor(app) {
        this.app = app;
        this.instance = null;
        this.initialized = false;
        this.available = false;
        this.loading = false;
        this.mode = null;
        this.lastError = null;
        this.loadedScriptUrl = null;
        this.loadPromise = null;
        this.registeredTools = [];
        this.writeConfirmationPolicy = this.resolveWriteConfirmationPolicy(
            window.eXeLearning?.config?.webmcpWriteConfirmationPolicy,
        );
        this.writeSessionApproved = false;
    }

    init() {
        if (this.initialized) {
            return this.initializeInstance();
        }

        this.initialized = true;
        return this.initializeInstance();
    }

    async ensureReady(options = {}) {
        const forceReload = options.forceReload === true;

        if (this.hasNativeModelContext()) {
            return this.initializeNativeInstance(forceReload);
        }

        if (this.instance && !forceReload) {
            return true;
        }

        if (!this.getWebMcpConstructor() || forceReload) {
            if (this.loading && this.loadPromise && !forceReload) {
                return this.loadPromise;
            }

            this.loadPromise = this.loadAndInitialize(forceReload);
            return this.loadPromise;
        }

        return this.initializeInstance();
    }

    getScriptCandidates() {
        const candidates = [];
        const config = window.eXeLearning?.config || {};

        if (typeof config.webmcpScriptUrl === 'string') {
            candidates.push(config.webmcpScriptUrl);
        }
        if (Array.isArray(config.webmcpScriptUrls)) {
            config.webmcpScriptUrls.forEach((url) => {
                if (typeof url === 'string') {
                    candidates.push(url);
                }
            });
        }

        if (typeof this.app?.composeUrl === 'function') {
            candidates.push(this.app.composeUrl(WEBMCP_LOCAL_SCRIPT_PATH));
            candidates.push(this.app.composeUrl(WEBMCP_ROOT_SCRIPT_PATH));
        } else {
            candidates.push(`/${WEBMCP_LOCAL_SCRIPT_PATH}`);
            candidates.push(`/${WEBMCP_ROOT_SCRIPT_PATH}`);
        }

        WEBMCP_FALLBACK_REMOTE_SCRIPT_URLS.forEach((url) => {
            candidates.push(url);
        });

        return [...new Set(candidates.filter((url) => typeof url === 'string' && url.trim()))];
    }

    async loadAndInitialize(forceReload) {
        this.loading = true;
        this.lastError = null;

        try {
            if (!this.getWebMcpConstructor() || forceReload) {
                await this.loadWebMcpLibrary(forceReload);
            }

            return this.initializeWebMcpJsInstance(forceReload);
        } catch (error) {
            this.available = !!this.getWebMcpConstructor();
            this.lastError = String(error?.message || error || 'Unknown error');
            this.instance = null;
            this.mode = null;
            return false;
        } finally {
            this.loading = false;
        }
    }

    async loadWebMcpLibrary(forceReload) {
        const candidates = this.getScriptCandidates();
        const failedSources = [];

        for (const sourceUrl of candidates) {
            try {
                await this.injectScript(sourceUrl, forceReload);
                const constructor = this.getWebMcpConstructor();
                if (constructor) {
                    if (typeof window.WebMCP !== 'function') {
                        window.WebMCP = constructor;
                    }
                    this.loadedScriptUrl = sourceUrl;
                    this.available = true;
                    return;
                }
                failedSources.push(
                    `Script loaded from "${sourceUrl}" but no WebMCP constructor was detected.`,
                );
            } catch (error) {
                failedSources.push(String(error?.message || error || 'Unknown error'));
            }
        }

        throw new Error(
            `Unable to load webmcp.js from configured sources. Tried: ${candidates.join(
                ', ',
            )}. Errors: ${failedSources.join(' | ') || 'none'}`,
        );
    }

    injectScript(url, forceReload = false) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.async = true;
            script.defer = true;
            script.crossOrigin = 'anonymous';
            script.dataset.webmcp = 'true';
            script.src = forceReload ? this.addCacheBust(url) : url;

            script.onload = () => resolve();
            script.onerror = () => {
                reject(new Error(`Failed to load WebMCP script: ${url}`));
            };

            document.head.append(script);
        });
    }

    addCacheBust(url) {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}t=${Date.now()}`;
    }

    initializeInstance(forceReload = false) {
        if (this.hasNativeModelContext()) {
            return this.initializeNativeInstance(forceReload);
        }

        return this.initializeWebMcpJsInstance(forceReload);
    }

    hasNativeModelContext() {
        return typeof navigator?.modelContext?.registerTool === 'function';
    }

    initializeNativeInstance(forceReload = false) {
        this.available = this.hasNativeModelContext();

        if (!this.available) {
            this.instance = null;
            this.mode = null;
            return false;
        }

        if (this.instance && this.mode === 'native' && !forceReload) {
            return true;
        }

        try {
            this.instance = navigator.modelContext;
            this.mode = 'native';
            this.registeredTools = [];
            this.registerDefaultTools();
            this.lastError = null;
            this.loadedScriptUrl = null;
            return true;
        } catch (error) {
            this.lastError = String(error?.message || error || 'Unknown error');
            this.instance = null;
            this.mode = null;
            return false;
        }
    }

    initializeWebMcpJsInstance(forceReload = false) {
        const WebMcpConstructor = this.getWebMcpConstructor();
        this.available = typeof WebMcpConstructor === 'function';

        if (!this.available) {
            this.instance = null;
            this.mode = null;
            return false;
        }

        if (this.instance && this.mode === 'webmcp-js' && !forceReload) {
            return true;
        }

        try {
            if (typeof window.WebMCP !== 'function') {
                window.WebMCP = WebMcpConstructor;
            }

            this.instance = new WebMcpConstructor({
                color: '#0d6efd',
                position: 'bottom-right',
                size: '40px',
                padding: '14px',
            });

            this.mode = 'webmcp-js';
            this.registeredTools = [];
            this.registerDefaultTools();
            this.lastError = null;
            return true;
        } catch (error) {
            this.lastError = String(error?.message || error || 'Unknown error');
            this.instance = null;
            this.mode = null;
            return false;
        }
    }

    getWebMcpConstructor() {
        if (typeof window?.WebMCP === 'function') {
            return window.WebMCP;
        }

        if (typeof globalThis?.WebMCP === 'function') {
            return globalThis.WebMCP;
        }

        if (typeof WebMCP === 'function') {
            return WebMCP;
        }

        return null;
    }

    getClientConfigSnippet() {
        return JSON.stringify(
            {
                mcpServers: {
                    webmcp: {
                        command: 'npx',
                        args: ['-y', '@jason.today/webmcp@latest', '--mcp'],
                    },
                },
            },
            null,
            2,
        );
    }

    getDocsUrl() {
        return WEBMCP_DOCS_URL;
    }

    isReady() {
        return !!this.instance;
    }

    isLoading() {
        return this.loading;
    }

    canOpenWidget() {
        return this.mode === 'webmcp-js';
    }

    getStatus() {
        if (this.mode === 'native' && this.instance) {
            return {
                label: 'Ready (native WebMCP)',
                className: 'text-success',
                description: `${this.registeredTools.length} tools registered via navigator.modelContext.`,
            };
        }

        if (this.loading) {
            return {
                label: 'Loading WebMCP script...',
                className: 'text-info',
                description: 'Trying to load webmcp.js automatically.',
            };
        }

        if (this.lastError) {
            return {
                label: 'Error',
                className: 'text-danger',
                description: this.lastError,
            };
        }

        if (!this.available) {
            return {
                label: 'WebMCP unavailable',
                className: 'text-warning',
                description:
                    'This browser does not expose navigator.modelContext and webmcp.js is not loaded.',
            };
        }

        if (!this.instance) {
            return {
                label: 'WebMCP unavailable',
                className: 'text-danger',
                description: 'The WebMCP instance could not be created.',
            };
        }

        return {
            label: 'Ready',
            className: 'text-success',
            description: `${this.registeredTools.length} tools registered${
                this.loadedScriptUrl ? ` (source: ${this.loadedScriptUrl})` : ''
            }`,
        };
    }

    getRegisteredTools() {
        return this.registeredTools.map((tool) => ({ ...tool }));
    }

    openWidget() {
        if (!this.instance || !this.canOpenWidget()) {
            return false;
        }

        try {
            if (typeof this.instance.open === 'function') {
                this.instance.open();
                return true;
            }
            if (typeof this.instance.toggle === 'function') {
                this.instance.toggle();
                return true;
            }
        } catch {
            // Fall through to DOM fallback.
        }

        const widget = document.querySelector(
            '.webmcp-widget, #webmcp-widget, [data-webmcp-widget]'
        );
        if (widget && typeof widget.click === 'function') {
            widget.click();
            return true;
        }

        return false;
    }

    registerDefaultTools() {
        this.registerTool(
            'exe.context.current',
            'Get current editor context and IDs',
            {},
            async () => this.getCurrentContext(),
            { writes: false },
        );

        this.registerTool(
            'exe.project.get_metadata',
            'Get current project metadata and missing required fields',
            {},
            async () => this.getProjectMetadataStatus(),
            { writes: false },
        );

        this.registerTool(
            'exe.project.ensure_metadata',
            'Set/validate required project metadata (title, author, description)',
            {
                title: { type: 'string' },
                author: { type: 'string' },
                description: { type: 'string' },
            },
            async (args) => this.ensureProjectMetadata(args),
            { writes: true },
        );

        this.registerTool(
            'exe.pages.create',
            'Create a page in the project',
            {
                name: { type: 'string' },
                parentId: { type: 'string' },
                order: { type: 'number' },
            },
            async (args) => this.createPage(args),
            { writes: true },
        );

        this.registerTool(
            'exe.pages.move',
            'Move a page to another parent or position',
            {
                pageId: { type: 'string' },
                parentId: { type: 'string' },
                position: { type: 'number' },
            },
            async (args) => this.movePage(args),
            { writes: true },
        );

        this.registerTool(
            'exe.pages.delete',
            'Delete a page and all its descendants',
            {
                pageId: { type: 'string' },
            },
            async (args) => this.deletePage(args),
            { writes: true },
        );

        this.registerTool(
            'exe.blocks.create',
            'Create a block in a page',
            {
                pageId: { type: 'string' },
                name: { type: 'string' },
                order: { type: 'number' },
            },
            async (args) => this.createBlock(args),
            { writes: true },
        );

        this.registerTool(
            'exe.blocks.move',
            'Move a block to another page or reorder blocks',
            {
                blockId: { type: 'string' },
                targetPageId: { type: 'string' },
                order: { type: 'number' },
            },
            async (args) => this.moveBlock(args),
            { writes: true },
        );

        this.registerTool(
            'exe.components.create',
            'Create a generic iDevice component',
            {
                pageId: { type: 'string' },
                blockId: { type: 'string' },
                ideviceType: { type: 'string' },
                title: { type: 'string' },
                html: { type: 'string' },
                jsonProperties: { type: 'string' },
                order: { type: 'number' },
            },
            async (args) => this.createComponent(args),
            { writes: true },
        );

        this.registerTool(
            'exe.idevices.text.add',
            'Create a text iDevice with required project metadata and required block title',
            {
                pageId: { type: 'string' },
                blockId: { type: 'string' },
                blockName: { type: 'string' },
                iconName: { type: 'string' },
                title: { type: 'string' },
                html: { type: 'string' },
                order: { type: 'number' },
                projectTitle: { type: 'string' },
                projectAuthor: { type: 'string' },
                projectDescription: { type: 'string' },
            },
            async (args) => this.addTextIdevice(args),
            { writes: true },
        );

        this.registerTool(
            'exe.idevices.az_quiz_game.add',
            'Create an A-Z quiz (rosco) iDevice with words and definitions',
            {
                pageId: { type: 'string' },
                blockId: { type: 'string' },
                blockName: { type: 'string' },
                iconName: { type: 'string' },
                title: { type: 'string' },
                entries: { type: 'array' },
                instructions: { type: 'string' },
                textAfter: { type: 'string' },
                durationGame: { type: 'number' },
                numberTurns: { type: 'number' },
                showSolution: { type: 'boolean' },
                timeShowSolution: { type: 'number' },
                modeBoard: { type: 'boolean' },
                caseSensitive: { type: 'boolean' },
                projectTitle: { type: 'string' },
                projectAuthor: { type: 'string' },
                projectDescription: { type: 'string' },
            },
            async (args) => this.addAzQuizGameIdevice(args),
            { writes: true },
        );

        this.registerTool(
            'exe.idevices.image_gallery.add',
            'Create an Image Gallery iDevice from image URLs or picsum seeds',
            {
                pageId: { type: 'string' },
                blockId: { type: 'string' },
                blockName: { type: 'string' },
                iconName: { type: 'string' },
                title: { type: 'string' },
                images: { type: 'array' },
                projectTitle: { type: 'string' },
                projectAuthor: { type: 'string' },
                projectDescription: { type: 'string' },
            },
            async (args) => this.addImageGalleryIdevice(args),
            { writes: true },
        );

        this.registerTool(
            'exe.idevices.form.add',
            'Create a Form iDevice with structured questions',
            {
                pageId: { type: 'string' },
                blockId: { type: 'string' },
                blockName: { type: 'string' },
                iconName: { type: 'string' },
                title: { type: 'string' },
                questions: { type: 'array' },
                instructions: { type: 'string' },
                textAfter: { type: 'string' },
                time: { type: 'number' },
                showSlider: { type: 'boolean' },
                questionsRandom: { type: 'boolean' },
                percentageQuestions: { type: 'number' },
                addBtnAnswers: { type: 'boolean' },
                evaluation: { type: 'boolean' },
                evaluationID: { type: 'string' },
                isScorm: { type: 'number' },
                textButtonScorm: { type: 'string' },
                weighted: { type: 'number' },
                projectTitle: { type: 'string' },
                projectAuthor: { type: 'string' },
                projectDescription: { type: 'string' },
            },
            async (args) => this.addFormIdevice(args),
            { writes: true },
        );

        this.registerTool(
            'exe.idevices.icons.list',
            'List available block icons for the current theme',
            {},
            async () => this.listIdeviceIcons(),
            { writes: false },
        );

        this.registerTool(
            'exe.idevices.text.set_rich_html',
            'Set formatted HTML content in a text iDevice',
            {
                componentId: { type: 'string' },
                html: { type: 'string' },
            },
            async (args) => this.setTextIdeviceRichHtml(args),
            { writes: true },
        );

        this.registerTool(
            'exe.idevices.text.append_rich_html',
            'Append or prepend formatted HTML to a text iDevice',
            {
                componentId: { type: 'string' },
                html: { type: 'string' },
                position: { type: 'string' },
            },
            async (args) => this.appendTextIdeviceRichHtml(args),
            { writes: true },
        );

        this.registerTool(
            'exe.idevices.text.insert_image_base64',
            'Insert an AI-generated image (base64) into a text iDevice',
            {
                componentId: { type: 'string' },
                base64: { type: 'string' },
                filename: { type: 'string' },
                mimeType: { type: 'string' },
                folderPath: { type: 'string' },
                alt: { type: 'string' },
                caption: { type: 'string' },
                width: { type: 'string' },
                align: { type: 'string' },
                position: { type: 'string' },
            },
            async (args) => this.insertTextIdeviceImageFromBase64(args),
            { writes: true },
        );

        this.registerTool(
            'exe.idevices.text.insert_image_url',
            'Insert an internet image URL into a text iDevice',
            {
                componentId: { type: 'string' },
                imageUrl: { type: 'string' },
                filename: { type: 'string' },
                mimeType: { type: 'string' },
                folderPath: { type: 'string' },
                alt: { type: 'string' },
                caption: { type: 'string' },
                width: { type: 'string' },
                align: { type: 'string' },
                position: { type: 'string' },
                allowExternalFallback: { type: 'boolean' },
                picsumSeed: { type: 'string' },
                picsumWidth: { type: 'number' },
                picsumHeight: { type: 'number' },
            },
            async (args) => this.insertTextIdeviceImageFromUrl(args),
            { writes: true },
        );

        this.registerTool(
            'exe.components.set_html',
            'Update HTML content of a component',
            {
                componentId: { type: 'string' },
                html: { type: 'string' },
            },
            async (args) => this.setComponentHtml(args),
            { writes: true },
        );

        this.registerTool(
            'exe.components.delete',
            'Delete an iDevice component',
            {
                componentId: { type: 'string' },
            },
            async (args) => this.deleteComponent(args),
            { writes: true },
        );

        this.registerTool(
            'exe.assets.upload_base64',
            'Upload an asset from base64 and add it to the file manager',
            {
                filename: { type: 'string' },
                base64: { type: 'string' },
                mimeType: { type: 'string' },
                folderPath: { type: 'string' },
            },
            async (args) => this.uploadAssetFromBase64(args),
            { writes: true },
        );

        this.registerTool(
            'exe.assets.upload_data_url',
            'Upload an asset from a data URL and add it to the file manager',
            {
                filename: { type: 'string' },
                dataUrl: { type: 'string' },
                folderPath: { type: 'string' },
            },
            async (args) => this.uploadAssetFromDataUrl(args),
            { writes: true },
        );

        this.registerTool(
            'exe.assets.import_image_url',
            'Fetch an internet image and add it to the file manager',
            {
                imageUrl: { type: 'string' },
                picsumSeed: { type: 'string' },
                picsumWidth: { type: 'number' },
                picsumHeight: { type: 'number' },
                filename: { type: 'string' },
                mimeType: { type: 'string' },
                folderPath: { type: 'string' },
            },
            async (args) => this.importAssetFromUrl(args),
            { writes: true },
        );

        this.registerTool(
            'exe.assets.list',
            'List file manager assets',
            {
                folderPath: { type: 'string' },
            },
            async (args) => this.listAssets(args),
            { writes: false },
        );

        this.registerTool(
            'exe.idevices.text.insert_image_asset',
            'Insert an existing file-manager image into a text iDevice',
            {
                componentId: { type: 'string' },
                assetId: { type: 'string' },
                assetUrl: { type: 'string' },
                alt: { type: 'string' },
                caption: { type: 'string' },
                width: { type: 'string' },
                align: { type: 'string' },
                position: { type: 'string' },
            },
            async (args) => this.insertTextIdeviceImageFromAsset(args),
            { writes: true },
        );

        this.registerTool(
            'exe.project.save',
            'Save the current project using Yjs',
            {},
            async () => this.saveProject(),
            { writes: true },
        );
    }

    registerTool(name, description, inputSchema, handler, options = {}) {
        if (!this.instance || typeof this.instance.registerTool !== 'function') {
            return;
        }

        const writes = options.writes === true;
        const execute = async (args = {}) => {
            try {
                if (writes && !this.confirmWriteAction(name)) {
                    return this.wrapResult({
                        success: false,
                        error: 'Cancelled by user',
                    });
                }

                const result = await handler(args);
                return this.wrapResult({ success: true, data: result });
            } catch (error) {
                return this.wrapResult({
                    success: false,
                    error: String(error?.message || error || 'Unknown error'),
                });
            }
        };

        if (this.mode === 'native') {
            this.instance.registerTool({
                name,
                description,
                inputSchema: {
                    type: 'object',
                    properties: inputSchema || {},
                    additionalProperties: true,
                },
                execute,
                annotations: {
                    readOnlyHint: !writes,
                },
            });
        } else {
            this.instance.registerTool(
                name,
                description,
                inputSchema,
                execute,
            );
        }

        this.registeredTools.push({ name, description, writes });
    }

    confirmWriteAction(toolName) {
        if (this.writeConfirmationPolicy === 'none') {
            return true;
        }

        if (this.writeConfirmationPolicy === 'session') {
            if (this.writeSessionApproved) {
                return true;
            }

            const approved = window.confirm(
                'Allow MCP write actions for this browser session?'
            );
            if (approved) {
                this.writeSessionApproved = true;
            }
            return approved;
        }

        return window.confirm(
            `Allow MCP action "${toolName}" to modify this project?`
        );
    }

    wrapResult(payload) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(payload, null, 2),
                },
            ],
        };
    }

    getCurrentContext() {
        const binding = this.getStructureBinding();
        const pages = binding.getPages();
        const selectedPageId = this.getSelectedPageId();
        const metadataStatus = this.getProjectMetadataStatus();

        return {
            projectId: this.app?.project?.odeId || this.app?.project?.yjsProjectId || null,
            selectedPageId: selectedPageId || null,
            pagesCount: pages.length,
            metadataReady: metadataStatus.ready,
            missingProjectMetadata: metadataStatus.missing,
            projectMetadata: metadataStatus.metadata,
            writeConfirmationPolicy: this.writeConfirmationPolicy,
            writeSessionApproved: this.writeSessionApproved,
            tools: this.registeredTools.map((tool) => tool.name),
        };
    }

    getProjectMetadataStatus() {
        const bridge = this.getBridge();
        const metadata = bridge.getMetadata?.() || {};
        const normalized = {
            title: this.normalizeMetadataValue(metadata.title),
            author: this.normalizeMetadataValue(metadata.author),
            description: this.normalizeMetadataValue(metadata.description),
            language: this.normalizeMetadataValue(metadata.language),
            license: this.normalizeMetadataValue(metadata.license),
            createdAt: this.normalizeMetadataValue(metadata.createdAt),
            modifiedAt: this.normalizeMetadataValue(metadata.modifiedAt),
        };
        const missing = this.getMissingRequiredMetadataFields(normalized);

        return {
            ready: missing.length === 0,
            missing,
            metadata: normalized,
        };
    }

    ensureProjectMetadata(args = {}) {
        const bridge = this.getBridge();
        const title = this.optionalString(args.title);
        const author = this.optionalString(args.author);
        const description = this.optionalString(args.description);
        const updates = {};

        if (title !== null) {
            updates.title = title;
        }
        if (author !== null) {
            updates.author = author;
        }
        if (description !== null) {
            updates.description = description;
        }
        if (Object.keys(updates).length > 0) {
            bridge.updateMetadata(updates);
        }

        const status = this.getProjectMetadataStatus();
        if (!status.ready) {
            throw new Error(
                `Project metadata is incomplete. Missing: ${status.missing.join(
                    ', ',
                )}. Use exe.project.ensure_metadata with title, author and description.`,
            );
        }

        return status;
    }

    async createPage(args) {
        const bridge = this.getBridge();
        const name = this.requireString(args.name, 'name');
        const parentId = this.optionalString(args.parentId);
        const pageReused = this.tryReuseInitialBlankPage(name, parentId);

        if (pageReused) {
            const position = this.optionalNumber(args.order);
            if (position !== null) {
                bridge.movePage(pageReused.pageId, parentId, position);
            }

            await this.refreshStructure(pageReused.pageId);
            return {
                ...pageReused,
                reusedInitialPage: true,
            };
        }

        const created = bridge.addPage(name, parentId);

        const position = this.optionalNumber(args.order);
        if (position !== null) {
            bridge.movePage(created.id, parentId, position);
        }

        await this.refreshStructure(created.id);
        return created;
    }

    tryReuseInitialBlankPage(targetName, parentId = null) {
        if (parentId) {
            return null;
        }

        const bridge = this.getBridge();
        const pages = this.getStructureBinding().getPages();
        if (!Array.isArray(pages) || pages.length !== 1) {
            return null;
        }

        const onlyPage = pages[0];
        if (!this.isInitialBlankPage(onlyPage)) {
            return null;
        }

        const pageId = onlyPage.id || onlyPage.pageId;
        if (!pageId) {
            return null;
        }

        bridge.updatePage(pageId, {
            pageName: targetName,
            title: targetName,
        });

        return bridge.getPage(pageId) || {
            id: pageId,
            pageId,
            pageName: targetName,
            parentId: null,
            order: 0,
            blockCount: 0,
        };
    }

    isInitialBlankPage(page) {
        if (!page) return false;
        if (page.parentId !== null && page.parentId !== undefined && page.parentId !== '') return false;
        if ((page.blockCount || 0) > 0) return false;
        if ((page.order ?? 0) !== 0) return false;

        const rawName = this.normalizeMetadataValue(page.pageName || page.title || '');
        if (!rawName) return false;

        const localizedNewPage = this.normalizeMetadataValue(
            typeof _ === 'function' ? _('New page') : '',
        );
        const candidates = new Set(
            [
                'new page',
                'nueva página',
                'nueva pagina',
                localizedNewPage.toLowerCase(),
            ].filter(Boolean),
        );

        return candidates.has(rawName.toLowerCase());
    }

    async movePage(args) {
        const bridge = this.getBridge();
        const pageId = this.requireString(args.pageId, 'pageId');
        const parentId = this.optionalString(args.parentId);
        const position = this.optionalNumber(args.position);

        bridge.movePage(pageId, parentId, position);
        await this.refreshStructure(pageId);

        const page = bridge.getPage(pageId);
        return { pageId, page };
    }

    async deletePage(args) {
        const bridge = this.getBridge();
        const pageId = this.requireString(args.pageId, 'pageId');
        const deleted = bridge.deletePage(pageId);

        await this.refreshStructure(this.getSelectedPageId());
        return { pageId, deleted };
    }

    async createBlock(args) {
        const bridge = this.getBridge();
        const pageId = this.requirePageId(args.pageId);
        const name = this.optionalString(args.name) || 'Content';
        const order = this.optionalNumber(args.order);

        const blockId = bridge.addBlock(pageId, name, null, order);
        await this.refreshStructure(pageId);

        return {
            pageId,
            blockId,
            block: this.getStructureBinding().getBlock(blockId),
        };
    }

    async moveBlock(args) {
        const binding = this.getStructureBinding();
        const blockId = this.requireString(args.blockId, 'blockId');
        const targetPageId = this.optionalString(args.targetPageId);
        const order = this.optionalNumber(args.order);

        let moved = false;
        if (targetPageId) {
            moved = binding.moveBlockToPage(blockId, targetPageId, order);
        } else if (order !== null) {
            moved = binding.updateBlockOrder(blockId, order);
        } else {
            throw new Error('Provide targetPageId and/or order');
        }

        await this.refreshStructure(targetPageId || this.getSelectedPageId());
        return {
            blockId,
            moved,
            block: binding.getBlock(blockId),
        };
    }

    async createComponent(args) {
        const bridge = this.getBridge();
        const pageId = this.requirePageId(args.pageId);
        const blockId = this.requireString(args.blockId, 'blockId');
        const ideviceType = this.optionalString(args.ideviceType) || 'text';
        const order = this.optionalNumber(args.order);

        const initialData = {};
        if (typeof args.title === 'string') {
            initialData.title = args.title;
        }
        if (typeof args.html === 'string') {
            initialData.htmlContent = args.html;
            if (this.isTextIdeviceType(ideviceType)) {
                initialData.htmlView = args.html;
                if (args.jsonProperties === undefined) {
                    initialData.jsonProperties = JSON.stringify(
                        this.buildTextIdeviceJsonProperties(args.html),
                    );
                }
            }
        }
        if (args.jsonProperties !== undefined) {
            initialData.jsonProperties = this.normalizeJsonPropertiesForStorage(
                args.jsonProperties,
                'jsonProperties',
            );
        }
        if (order !== null) {
            initialData.order = order;
        }

        const componentId = bridge.addComponent(pageId, blockId, ideviceType, initialData);
        await this.refreshStructure(pageId);

        return {
            componentId,
            ideviceType,
            component: this.getStructureBinding().getComponent(componentId),
        };
    }

    prepareIdeviceTarget(args) {
        const bridge = this.getBridge();
        const pageId = this.requirePageId(args.pageId);
        let blockId = this.optionalString(args.blockId);
        const blockName = this.requireString(args.blockName, 'blockName');
        const iconName = this.resolveOptionalIconName(args.iconName);

        if (!blockId) {
            blockId = bridge.addBlock(pageId, blockName, null, null);
        }

        const binding = this.getStructureBinding();
        const blockUpdates = { blockName };
        if (iconName !== null) {
            blockUpdates.iconName = iconName;
        }
        binding.updateBlock(blockId, blockUpdates);

        return {
            pageId,
            blockId,
            blockName,
            iconName: iconName || '',
        };
    }

    buildComponentInitialData(args = {}) {
        const initialData = {};

        const title = this.optionalString(args.title);
        if (title !== null) {
            initialData.title = title;
        }

        if (typeof args.htmlContent === 'string') {
            initialData.htmlContent = args.htmlContent;
            initialData.htmlView =
                typeof args.htmlView === 'string' ? args.htmlView : args.htmlContent;
        } else if (typeof args.htmlView === 'string') {
            initialData.htmlView = args.htmlView;
        }

        if (args.jsonProperties !== undefined) {
            initialData.jsonProperties = this.normalizeJsonPropertiesForStorage(
                args.jsonProperties,
                'jsonProperties',
            );
        }

        const order = this.optionalNumber(args.order);
        if (order !== null) {
            initialData.order = order;
        }

        return initialData;
    }

    normalizeJsonPropertiesForStorage(value, fieldName = 'jsonProperties') {
        if (value === undefined || value === null) {
            return '{}';
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) {
                return '{}';
            }

            try {
                const parsed = JSON.parse(trimmed);
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    throw new Error(`${fieldName} must be a JSON object`);
                }
                return JSON.stringify(parsed);
            } catch (error) {
                if (error?.message === `${fieldName} must be a JSON object`) {
                    throw error;
                }
                throw new Error(`${fieldName} is not valid JSON`);
            }
        }

        if (typeof value === 'object') {
            if (Array.isArray(value)) {
                throw new Error(`${fieldName} must be a JSON object`);
            }
            return JSON.stringify(value);
        }

        throw new Error(`${fieldName} must be a JSON object or JSON string`);
    }

    async addTextIdevice(args) {
        const bridge = this.getBridge();
        this.ensureProjectMetadata({
            title: args.projectTitle,
            author: args.projectAuthor,
            description: args.projectDescription,
        });

        const { pageId, blockId, blockName, iconName } =
            this.prepareIdeviceTarget(args);

        const html =
            typeof args.html === 'string' && args.html.trim().length > 0
                ? args.html
                : '<p></p>';

        const initialData = this.buildComponentInitialData({
            title: this.optionalString(args.title) || blockName,
            htmlContent: html,
            jsonProperties: this.buildTextIdeviceJsonProperties(html),
            order: args.order,
        });

        const componentId = bridge.addComponent(pageId, blockId, 'text', initialData);
        await this.refreshStructure(pageId);

        return {
            pageId,
            blockId,
            blockName,
            iconName: iconName || '',
            componentId,
            component: this.getStructureBinding().getComponent(componentId),
        };
    }

    async addAzQuizGameIdevice(args) {
        const bridge = this.getBridge();
        this.ensureProjectMetadata({
            title: args.projectTitle,
            author: args.projectAuthor,
            description: args.projectDescription,
        });

        const { pageId, blockId, blockName, iconName } =
            this.prepareIdeviceTarget(args);
        const dataGame = this.buildAzQuizGameData(args);
        const textAfter = this.optionalString(args.textAfter) || '';
        const html = this.buildAzQuizGameHtml(dataGame, textAfter);
        const initialData = this.buildComponentInitialData({
            title: this.optionalString(args.title) || blockName,
            htmlContent: html,
            jsonProperties: {
                dataGame,
                textAfter,
            },
            order: args.order,
        });

        const componentId = bridge.addComponent(
            pageId,
            blockId,
            'az-quiz-game',
            initialData,
        );
        await this.refreshStructure(pageId);

        return {
            pageId,
            blockId,
            blockName,
            iconName,
            componentId,
            entriesCount: dataGame.wordsGame.length,
            component: this.getStructureBinding().getComponent(componentId),
        };
    }

    async addImageGalleryIdevice(args) {
        const bridge = this.getBridge();
        this.ensureProjectMetadata({
            title: args.projectTitle,
            author: args.projectAuthor,
            description: args.projectDescription,
        });

        const { pageId, blockId, blockName, iconName } =
            this.prepareIdeviceTarget(args);
        const galleryData = this.buildImageGalleryJsonProperties(args);
        const initialData = this.buildComponentInitialData({
            title: this.optionalString(args.title) || blockName,
            htmlContent: '',
            htmlView: '',
            jsonProperties: galleryData,
            order: args.order,
        });

        const componentId = bridge.addComponent(pageId, blockId, 'image-gallery', initialData);
        await this.refreshStructure(pageId);

        return {
            pageId,
            blockId,
            blockName,
            iconName,
            componentId,
            imagesCount: Object.keys(galleryData).filter((key) => key !== 'ideviceId').length,
            component: this.getStructureBinding().getComponent(componentId),
        };
    }

    buildImageGalleryJsonProperties(args = {}) {
        const images = this.normalizeImageGalleryImages(args.images);
        const data = {
            ideviceId: this.optionalString(args.ideviceId) || '',
        };

        images.forEach((image, index) => {
            data[`img_${index}`] = image;
        });

        return data;
    }

    normalizeImageGalleryImages(value) {
        const images = this.parseArrayValue(value, 'images');
        if (images.length === 0) {
            throw new Error('images must contain at least one item');
        }

        return images.map((entry, index) => {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                throw new Error(`images[${index}] must be an object`);
            }

            const imageUrl = this.resolveImageUrlFromInput(
                entry.imageUrl ?? entry.url,
                {
                    picsumSeed:
                        entry.picsumSeed ??
                        entry.seed ??
                        entry.title ??
                        `gallery-${index + 1}`,
                    picsumWidth: entry.picsumWidth ?? entry.width,
                    picsumHeight: entry.picsumHeight ?? entry.height,
                    allowTextAsPicsumSeed: true,
                },
            );

            const thumbnailUrl = this.resolveImageUrlFromInput(
                entry.thumbnailUrl ?? entry.thumbnail ?? imageUrl,
                {
                    picsumSeed:
                        entry.thumbnailSeed ??
                        entry.picsumSeed ??
                        entry.seed ??
                        entry.title ??
                        `gallery-thumb-${index + 1}`,
                    picsumWidth: entry.thumbnailWidth ?? entry.width ?? 512,
                    picsumHeight: entry.thumbnailHeight ?? entry.height ?? 512,
                    allowTextAsPicsumSeed: true,
                },
            );

            return {
                img: imageUrl,
                thumbnail: thumbnailUrl,
                title: this.optionalString(entry.title) || '',
                linktitle: this.optionalString(entry.linktitle ?? entry.titleUrl) || '',
                author: this.optionalString(entry.author) || '',
                linkauthor: this.optionalString(entry.linkauthor ?? entry.authorUrl) || '',
                license: this.normalizeGalleryLicense(
                    entry.license ?? entry.licenseCode ?? '',
                ),
            };
        });
    }

    normalizeGalleryLicense(value) {
        const raw = this.optionalString(value);
        if (!raw) return '';
        const normalized = raw.toLowerCase();
        const map = {
            'public domain': 'pd',
            pd: 'pd',
            'gnu/gpl': 'gnu-gpl',
            'gnu-gpl': 'gnu-gpl',
            gpl: 'gnu-gpl',
            cc0: 'CC0',
            'creative commons by': 'CC-BY',
            'cc-by': 'CC-BY',
            'creative commons by-sa': 'CC-BY-SA',
            'cc-by-sa': 'CC-BY-SA',
            'creative commons by-nd': 'CC-BY-ND',
            'cc-by-nd': 'CC-BY-ND',
            'creative commons by-nc': 'CC-BY-NC',
            'cc-by-nc': 'CC-BY-NC',
            'creative commons by-nc-sa': 'CC-BY-NC-SA',
            'cc-by-nc-sa': 'CC-BY-NC-SA',
            'creative commons by-nc-nd': 'CC-BY-NC-ND',
            'cc-by-nc-nd': 'CC-BY-NC-ND',
            copyright: 'copyright',
        };
        return map[normalized] || raw;
    }

    async addFormIdevice(args) {
        const bridge = this.getBridge();
        this.ensureProjectMetadata({
            title: args.projectTitle,
            author: args.projectAuthor,
            description: args.projectDescription,
        });

        const { pageId, blockId, blockName, iconName } =
            this.prepareIdeviceTarget(args);
        const formData = this.buildFormJsonProperties(args);
        const initialData = this.buildComponentInitialData({
            title: this.optionalString(args.title) || blockName,
            htmlContent: '',
            htmlView: '',
            jsonProperties: formData,
            order: args.order,
        });

        const componentId = bridge.addComponent(pageId, blockId, 'form', initialData);
        await this.refreshStructure(pageId);

        return {
            pageId,
            blockId,
            blockName,
            iconName,
            componentId,
            questionsCount: formData.questionsData.length,
            component: this.getStructureBinding().getComponent(componentId),
        };
    }

    buildFormJsonProperties(args = {}) {
        const questionsData = this.normalizeFormQuestions(args.questions);
        const evaluation = this.optionalBoolean(args.evaluation, false);
        const evaluationID = this.optionalString(args.evaluationID) || '';
        if (evaluation && evaluationID.length < 5) {
            throw new Error('evaluationID must have at least 5 characters when evaluation=true');
        }

        const percentageQuestions = this.clampNumber(
            this.optionalNumber(args.percentageQuestions),
            1,
            100,
            100,
        );
        const passRate = this.clampNumber(
            this.optionalNumber(args.passRate),
            5,
            100,
            50,
        );
        const addBtnAnswers = this.optionalBoolean(args.addBtnAnswers, true);
        const isScorm = this.normalizeAzQuizScormMode(args.isScorm);
        const weighted = this.clampNumber(
            this.optionalNumber(args.weighted),
            1,
            100,
            100,
        );

        return {
            ideviceId: this.optionalString(args.ideviceId) || '',
            id: this.optionalString(args.id) || '',
            evaluation,
            evaluationID,
            repeatActivity: this.optionalBoolean(args.repeatActivity, true),
            isScorm,
            textButtonScorm: this.optionalString(args.textButtonScorm) || 'Save score',
            weighted,
            msgs: this.parseJsonObject(args.msgs ?? args.messages ?? {}),
            questionsRandom: this.optionalBoolean(args.questionsRandom, false),
            percentageQuestions,
            time: this.clampNumber(this.optionalNumber(args.time), 0, 3600, 0),
            eXeFormInstructions: this.optionalString(args.instructions) || '',
            questionsData,
            passRate,
            dropdownPassRate: String(passRate),
            addBtnAnswers,
            checkAddBtnAnswers: addBtnAnswers,
            eXeIdeviceTextAfter: this.optionalString(args.textAfter) || '',
            showSlider: this.optionalBoolean(args.showSlider, false),
        };
    }

    normalizeFormQuestions(value) {
        const questions = this.parseArrayValue(value, 'questions');
        if (questions.length === 0) {
            throw new Error('questions must contain at least one question');
        }

        return questions.map((question, index) =>
            this.normalizeSingleFormQuestion(question, index),
        );
    }

    normalizeSingleFormQuestion(question, index) {
        if (!question || typeof question !== 'object' || Array.isArray(question)) {
            throw new Error(`questions[${index}] must be an object`);
        }

        const activityTypeRaw =
            this.optionalString(question.activityType ?? question.type)?.toLowerCase() ||
            'selection';
        const activityType = this.normalizeFormActivityType(activityTypeRaw);
        const baseText = this.normalizeQuestionHtml(
            question.baseText ?? question.question ?? question.prompt ?? '',
            `questions[${index}]`,
        );
        const common = {
            id: this.optionalString(question.id) || this.generateLocalId('q'),
            activityType,
            baseText,
            feedbackRight: this.optionalString(question.feedbackRight) || '',
            feedbackWrong: this.optionalString(question.feedbackWrong) || '',
            suggestion: this.optionalString(question.suggestion) || '',
            customScore: this.optionalNumber(question.customScore) || 1,
            time: this.optionalNumber(question.time) || 0,
        };

        if (activityType === 'selection') {
            const selection = this.normalizeFormSelectionAnswers(question, index);
            return {
                ...common,
                selectionType: selection.selectionType,
                answers: selection.answers,
            };
        }

        if (activityType === 'true-false') {
            return {
                ...common,
                answer: this.normalizeTrueFalseAnswer(
                    question.answer ?? question.correct,
                    `questions[${index}].answer`,
                ),
            };
        }

        if (activityType === 'dropdown') {
            return {
                ...common,
                wrongAnswersValue: this.normalizeWrongAnswersValue(question),
            };
        }

        return {
            ...common,
            capitalization: this.optionalBoolean(question.capitalization, false),
            strict: this.optionalBoolean(question.strict, false),
        };
    }

    normalizeWrongAnswersValue(question) {
        const wrongAnswers = question.wrongAnswers;
        if (Array.isArray(wrongAnswers)) {
            return wrongAnswers
                .map((item) => this.optionalString(item) || '')
                .filter(Boolean)
                .join('|');
        }
        return this.optionalString(question.wrongAnswersValue) || '';
    }

    normalizeFormSelectionAnswers(question, index) {
        const answersInput = this.parseArrayValue(
            question.answers,
            `questions[${index}].answers`,
        );
        if (answersInput.length < 2) {
            throw new Error(`questions[${index}].answers must contain at least two options`);
        }

        let derivedCorrectCount = 0;
        const normalizedAnswers = answersInput.map((answer, answerIndex) => {
            if (Array.isArray(answer) && answer.length >= 2) {
                const isCorrect = this.optionalBoolean(answer[0], false);
                if (isCorrect) derivedCorrectCount++;
                return [isCorrect, this.requireString(answer[1], `questions[${index}].answers[${answerIndex}]`)];
            }

            if (answer && typeof answer === 'object') {
                const text = this.requireString(
                    answer.text ?? answer.label,
                    `questions[${index}].answers[${answerIndex}].text`,
                );
                const isCorrect = this.optionalBoolean(answer.correct, false);
                if (isCorrect) derivedCorrectCount++;
                return [isCorrect, text];
            }

            const text = this.requireString(
                answer,
                `questions[${index}].answers[${answerIndex}]`,
            );
            return [false, text];
        });

        if (derivedCorrectCount === 0) {
            const correctIndex = this.optionalNumber(question.correctIndex);
            const correctIndices = this.parseOptionalNumberArray(question.correctIndices);
            if (Number.isInteger(correctIndex)) {
                if (correctIndex >= 0 && correctIndex < normalizedAnswers.length) {
                    normalizedAnswers[correctIndex][0] = true;
                    derivedCorrectCount = 1;
                }
            } else if (correctIndices.length > 0) {
                correctIndices.forEach((idx) => {
                    if (idx >= 0 && idx < normalizedAnswers.length) {
                        normalizedAnswers[idx][0] = true;
                    }
                });
                derivedCorrectCount = normalizedAnswers.filter((ans) => ans[0]).length;
            } else {
                normalizedAnswers[0][0] = true;
                derivedCorrectCount = 1;
            }
        }

        const selectionTypeRaw =
            this.optionalString(question.selectionType)?.toLowerCase() || '';
        const selectionType =
            selectionTypeRaw === 'multiple'
                ? 'multiple'
                : selectionTypeRaw === 'single'
                    ? 'single'
                    : derivedCorrectCount > 1
                        ? 'multiple'
                        : 'single';

        return {
            selectionType,
            answers: normalizedAnswers,
        };
    }

    normalizeFormActivityType(value) {
        const normalized = String(value || '').toLowerCase();
        if (normalized === 'selection' || normalized === 'single' || normalized === 'multiple') {
            return 'selection';
        }
        if (normalized === 'true-false' || normalized === 'truefalse' || normalized === 'boolean') {
            return 'true-false';
        }
        if (normalized === 'dropdown' || normalized === 'select') {
            return 'dropdown';
        }
        if (normalized === 'fill' || normalized === 'fill-in' || normalized === 'fill-in-the-blank') {
            return 'fill';
        }
        throw new Error('question activityType must be selection, true-false, dropdown or fill');
    }

    normalizeTrueFalseAnswer(value, fieldName) {
        const numeric = this.optionalNumber(value);
        if (numeric !== null) {
            return numeric === 1 ? 1 : 0;
        }
        const normalized = this.optionalString(value)?.toLowerCase() || '';
        if (normalized === 'true' || normalized === 'verdadero' || normalized === 'v') return 1;
        if (normalized === 'false' || normalized === 'falso' || normalized === 'f') return 0;
        throw new Error(`${fieldName} must be true/false or 1/0`);
    }

    normalizeQuestionHtml(value, fieldPrefix) {
        const raw = this.optionalString(value);
        if (!raw) {
            throw new Error(`${fieldPrefix}.baseText is required`);
        }
        if (raw.includes('<')) {
            return raw;
        }
        return `<p>${this.escapeHtml(raw)}</p>`;
    }

    parseOptionalNumberArray(value) {
        if (Array.isArray(value)) {
            return value
                .map((item) => this.optionalNumber(item))
                .filter((item) => Number.isInteger(item));
        }
        if (typeof value === 'string' && value.trim().length > 0) {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) {
                    return parsed
                        .map((item) => this.optionalNumber(item))
                        .filter((item) => Number.isInteger(item));
                }
            } catch {
                return [];
            }
        }
        return [];
    }

    generateLocalId(prefix = 'id') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    buildAzQuizGameData(args = {}) {
        const wordsGame = this.normalizeAzQuizEntries(args.entries);
        const letters = wordsGame.map((item) => item.letter).join('');
        const durationGame = this.clampNumber(
            this.optionalNumber(args.durationGame),
            5,
            9999,
            240,
        );
        const numberTurns = this.clampNumber(
            this.optionalNumber(args.numberTurns),
            0,
            2,
            1,
        );
        const timeShowSolution = this.clampNumber(
            this.optionalNumber(args.timeShowSolution),
            1,
            9,
            3,
        );
        const weighted = this.clampNumber(
            this.optionalNumber(args.weighted),
            1,
            100,
            100,
        );
        const evaluation = this.optionalBoolean(args.evaluation, false);
        const evaluationID = this.optionalString(args.evaluationID) || '';
        if (evaluation && evaluationID.length < 5) {
            throw new Error('evaluationID must have at least 5 characters when evaluation=true');
        }

        const itinerary = this.normalizeAzQuizItinerary(args.itinerary, args);
        const showCodeAccess = itinerary.showCodeAccess === true;
        if (showCodeAccess && itinerary.codeAccess.length === 0) {
            throw new Error('itinerary.codeAccess is required when showCodeAccess=true');
        }
        if (showCodeAccess && itinerary.messageCodeAccess.length === 0) {
            throw new Error('itinerary.messageCodeAccess is required when showCodeAccess=true');
        }
        const showClue = itinerary.showClue === true;
        if (showClue && itinerary.clueGame.length === 0) {
            throw new Error('itinerary.clueGame is required when showClue=true');
        }

        const isScorm = this.normalizeAzQuizScormMode(args.isScorm);
        const textButtonScorm =
            this.optionalString(args.textButtonScorm) || 'Save score';
        const messages = this.normalizeAzQuizMessages(args.msgs ?? args.messages);

        return {
            typeGame: 'Rosco',
            instructions:
                this.optionalString(args.instructions) || AZ_QUIZ_DEFAULT_INSTRUCTIONS,
            timeShowSolution,
            durationGame,
            numberTurns,
            showSolution: this.optionalBoolean(args.showSolution, true),
            showMinimize: this.optionalBoolean(args.showMinimize, false),
            itinerary,
            wordsGame,
            isScorm,
            textButtonScorm,
            repeatActivity: this.optionalBoolean(args.repeatActivity, true),
            weighted,
            letters,
            textAfter: this.encodeLegacyText(this.optionalString(args.textAfter) || ''),
            caseSensitive: this.optionalBoolean(args.caseSensitive, false),
            version: 2,
            modeBoard: this.optionalBoolean(args.modeBoard, false),
            evaluation,
            evaluationID,
            id: this.optionalString(args.id) || '',
            msgs: messages,
        };
    }

    buildAzQuizGameHtml(dataGame, textAfter = '') {
        const instructions = this.optionalString(dataGame.instructions) || '';
        const serializedData = this.escapeHtml(JSON.stringify(dataGame));
        const linksImages = this.buildAzQuizMediaLinks(dataGame.wordsGame, 'url');
        const linksAudios = this.buildAzQuizMediaLinks(dataGame.wordsGame, 'audio');
        const encodedEvaluationId = this.escapeHtml(dataGame.evaluationID || '');
        const encodedIdeviceId = this.escapeHtml(dataGame.id || '');
        const browserMessage = this.escapeHtml(
            this.optionalString(dataGame.msgs?.msgNoSuportBrowser) ||
                AZ_QUIZ_DEFAULT_NOT_SUPPORTED_BROWSER_MESSAGE,
        );

        let html = '<div class="rosco-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${encodedIdeviceId}" data-evaluationb="${dataGame.evaluation ? 'true' : 'false'}" data-evaluationid="${encodedEvaluationId}"></div>`;
        if (instructions.length > 0) {
            html += `<div class="rosco-instructions">${instructions}</div>`;
        }
        html += `<div class="rosco-DataGame js-hidden">${serializedData}</div>`;
        html += linksImages;
        html += linksAudios;
        if (textAfter.length > 0) {
            html += `<div class="rosco-extra-content">${textAfter}</div>`;
        }
        html += `<div class="rosco-bns js-hidden">${browserMessage}</div>`;
        html += '</div>';
        return html;
    }

    buildAzQuizMediaLinks(wordsGame, field) {
        const className =
            field === 'audio' ? 'js-hidden rosco-LinkAudios' : 'js-hidden rosco-LinkImages';

        return wordsGame
            .map((word, index) => {
                const href = this.optionalString(word[field]) || '#';
                return `<a href="${this.escapeHtml(href)}" class="${className}">${index}</a>`;
            })
            .join('');
    }

    normalizeAzQuizEntries(value) {
        const entries = this.parseArrayValue(value, 'entries');
        if (entries.length === 0) {
            throw new Error('entries must contain at least one word/definition pair');
        }

        const seenLetters = new Set();
        return entries.map((rawEntry, index) => {
            if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
                throw new Error(`entries[${index}] must be an object`);
            }

            const word = this.requireString(rawEntry.word, `entries[${index}].word`);
            const definition = this.optionalString(rawEntry.definition) || '';
            const url =
                this.optionalString(rawEntry.url) ||
                this.optionalString(rawEntry.imageUrl) ||
                '';
            if (!definition && !url) {
                throw new Error(
                    `entries[${index}] must include definition or imageUrl/url`,
                );
            }

            const requestedLetter =
                this.optionalString(rawEntry.letter) || this.deriveAzQuizLetterFromWord(word);
            const letter = this.normalizeAzQuizLetter(
                requestedLetter,
                `entries[${index}].letter`,
            );
            if (seenLetters.has(letter)) {
                throw new Error(`entries contains duplicate letter "${letter}"`);
            }
            seenLetters.add(letter);

            return {
                letter,
                word,
                definition,
                type: this.normalizeAzQuizEntryType(rawEntry.mode ?? rawEntry.type),
                alt:
                    this.optionalString(rawEntry.alt) ||
                    this.optionalString(rawEntry.imageAlt) ||
                    '',
                author:
                    this.optionalString(rawEntry.author) ||
                    this.optionalString(rawEntry.imageAuthor) ||
                    '',
                url,
                audio:
                    this.optionalString(rawEntry.audio) ||
                    this.optionalString(rawEntry.audioUrl) ||
                    '',
                x: this.optionalNumber(rawEntry.x) || 0,
                y: this.optionalNumber(rawEntry.y) || 0,
            };
        });
    }

    normalizeAzQuizItinerary(rawItinerary, args = {}) {
        const itineraryFromArgs = this.parseJsonObject(rawItinerary || {});
        const fallback = {
            showClue: this.optionalBoolean(args.showClue, false),
            clueGame: this.optionalString(args.clueGame) || '',
            percentageClue: this.clampNumber(
                this.optionalNumber(args.percentageClue),
                10,
                100,
                40,
            ),
            showCodeAccess: this.optionalBoolean(args.showCodeAccess, false),
            codeAccess: this.optionalString(args.codeAccess) || '',
            messageCodeAccess: this.optionalString(args.messageCodeAccess) || '',
        };

        return {
            showClue: this.optionalBoolean(
                itineraryFromArgs.showClue,
                fallback.showClue,
            ),
            clueGame: this.optionalString(itineraryFromArgs.clueGame) || fallback.clueGame,
            percentageClue: this.clampNumber(
                this.optionalNumber(itineraryFromArgs.percentageClue),
                10,
                100,
                fallback.percentageClue,
            ),
            showCodeAccess: this.optionalBoolean(
                itineraryFromArgs.showCodeAccess,
                fallback.showCodeAccess,
            ),
            codeAccess:
                this.optionalString(itineraryFromArgs.codeAccess) || fallback.codeAccess,
            messageCodeAccess:
                this.optionalString(itineraryFromArgs.messageCodeAccess) ||
                fallback.messageCodeAccess,
        };
    }

    normalizeAzQuizMessages(value) {
        const input = this.parseJsonObject(value || {});
        return {
            ...AZ_QUIZ_DEFAULT_MESSAGES,
            ...input,
        };
    }

    normalizeAzQuizScormMode(value) {
        const numeric = this.optionalNumber(value);
        if (numeric !== null) {
            if (numeric <= 0) return 0;
            if (numeric === 1) return 1;
            return 2;
        }
        return this.optionalBoolean(value, false) ? 1 : 0;
    }

    normalizeAzQuizEntryType(value) {
        const numeric = this.optionalNumber(value);
        if (numeric !== null) {
            return numeric === 1 ? 1 : 0;
        }

        const normalized = this.optionalString(value)?.toLowerCase() || '';
        if (
            normalized === 'contains' ||
            normalized === 'contain' ||
            normalized === 'contiene'
        ) {
            return 1;
        }
        return 0;
    }

    deriveAzQuizLetterFromWord(word) {
        const normalizedWord = this.requireString(word, 'word')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();

        if (!normalizedWord) {
            return '';
        }

        return normalizedWord.charAt(0).toUpperCase();
    }

    normalizeAzQuizLetter(value, fieldName = 'letter') {
        const raw = this.requireString(value, fieldName).toUpperCase();
        if (raw === 'L·L') return '0';
        if (raw === 'SS') return '1';
        if (raw.length !== 1) {
            throw new Error(`${fieldName} must be a single letter, "L·L" or "SS"`);
        }
        return raw;
    }

    parseArrayValue(value, fieldName) {
        if (Array.isArray(value)) {
            return value;
        }

        if (typeof value === 'string' && value.trim().length > 0) {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) {
                    return parsed;
                }
            } catch {
                // Continue to error below.
            }
        }

        throw new Error(`${fieldName} must be an array`);
    }

    encodeLegacyText(value) {
        const text = String(value || '');
        if (typeof globalThis.escape === 'function') {
            return globalThis.escape(text);
        }
        return encodeURIComponent(text);
    }

    clampNumber(value, min, max, defaultValue) {
        if (!Number.isFinite(value)) {
            return defaultValue;
        }
        return Math.min(max, Math.max(min, value));
    }

    async setComponentHtml(args) {
        const binding = this.getStructureBinding();
        const componentId = this.requireString(args.componentId, 'componentId');
        const html = this.requireString(args.html, 'html');

        const component = binding.getComponent(componentId);
        if (!component) {
            throw new Error(`Component not found: ${componentId}`);
        }

        if (this.isTextIdeviceComponent(component)) {
            await this.updateTextIdeviceContent(componentId, html, component);
        } else {
            binding.updateComponent(componentId, { htmlContent: html });
            await this.refreshStructure(this.getSelectedPageId());
        }

        return {
            componentId,
            component: binding.getComponent(componentId),
        };
    }

    async setTextIdeviceRichHtml(args) {
        const componentId = this.requireString(args.componentId, 'componentId');
        const html = this.requireString(args.html, 'html');

        await this.updateTextIdeviceContent(componentId, html);
        return {
            componentId,
            htmlLength: html.length,
            component: this.getStructureBinding().getComponent(componentId),
        };
    }

    async appendTextIdeviceRichHtml(args) {
        const componentId = this.requireString(args.componentId, 'componentId');
        const fragment = this.requireString(args.html, 'html');
        const position = this.normalizeInsertPosition(args.position);

        const component = this.requireTextIdeviceComponent(componentId);
        const currentHtml =
            typeof component.htmlContent === 'string' ? component.htmlContent : '';
        const nextHtml = this.mergeHtmlContent(currentHtml, fragment, position);

        await this.updateTextIdeviceContent(componentId, nextHtml, component);

        return {
            componentId,
            position,
            appendedLength: fragment.length,
            htmlLength: nextHtml.length,
            component: this.getStructureBinding().getComponent(componentId),
        };
    }

    async updateTextIdeviceContent(componentId, html, existingComponent = null) {
        const binding = this.getStructureBinding();
        const component = existingComponent || this.requireTextIdeviceComponent(componentId);
        const jsonProperties = this.buildTextIdeviceJsonProperties(
            html,
            component?.jsonProperties,
        );

        binding.updateComponent(componentId, {
            htmlContent: html,
            htmlView: html,
            jsonProperties: JSON.stringify(jsonProperties),
        });

        await this.refreshStructure(this.getSelectedPageId());
    }

    async insertTextIdeviceImageFromBase64(args) {
        const componentId = this.requireString(args.componentId, 'componentId');
        this.requireTextIdeviceComponent(componentId);

        const filename =
            this.optionalString(args.filename) ||
            `ai-image-${Date.now()}.png`;
        const base64 = this.requireString(args.base64, 'base64');
        const mimeType = this.optionalString(args.mimeType) || this.detectMimeType(filename);
        const folderPath = this.optionalString(args.folderPath) || '';

        const bytes = this.base64ToUint8Array(base64);
        const file = this.createFileFromBytes(bytes, filename, mimeType);
        const assetData = await this.insertAssetFromFile(file, folderPath);
        const imageHtml = this.buildTextImageHtml({
            assetUrl: assetData.assetUrl,
            alt: this.optionalString(args.alt),
            caption: this.optionalString(args.caption),
            width: this.optionalString(args.width),
            align: this.optionalString(args.align),
        });

        const update = await this.appendTextIdeviceRichHtml({
            componentId,
            html: imageHtml,
            position: args.position,
        });

        return {
            componentId,
            asset: assetData,
            insertedHtml: imageHtml,
            update,
        };
    }

    async insertTextIdeviceImageFromUrl(args) {
        const componentId = this.requireString(args.componentId, 'componentId');
        this.requireTextIdeviceComponent(componentId);

        const imageUrl = this.resolveImageUrlFromInput(args.imageUrl, {
            picsumSeed: args.picsumSeed,
            picsumWidth: args.picsumWidth,
            picsumHeight: args.picsumHeight,
            allowTextAsPicsumSeed: true,
        });
        const folderPath = this.optionalString(args.folderPath) || '';
        const allowExternalFallback = this.optionalBoolean(args.allowExternalFallback, true);

        try {
            const response = await fetch(imageUrl);

            if (!response.ok) {
                throw new Error(
                    `Could not fetch image URL (${response.status} ${response.statusText})`
                );
            }

            const blob = await response.blob();
            if (!blob || blob.size <= 0) {
                throw new Error('Downloaded image is empty');
            }

            const filename =
                this.optionalString(args.filename) ||
                this.filenameFromImageUrl(imageUrl, blob.type);
            const mimeType =
                this.optionalString(args.mimeType) || blob.type || this.detectMimeType(filename);
            const file = this.createFileFromBlob(blob, filename, mimeType);
            const assetData = await this.insertAssetFromFile(file, folderPath);
            const imageHtml = this.buildTextImageHtml({
                assetUrl: assetData.assetUrl,
                alt: this.optionalString(args.alt),
                caption: this.optionalString(args.caption),
                width: this.optionalString(args.width),
                align: this.optionalString(args.align),
            });

            const update = await this.appendTextIdeviceRichHtml({
                componentId,
                html: imageHtml,
                position: args.position,
            });

            return {
                componentId,
                imageUrl,
                mode: 'asset',
                asset: assetData,
                insertedHtml: imageHtml,
                update,
            };
        } catch (error) {
            if (!allowExternalFallback) {
                throw error;
            }

            const imageHtml = this.buildTextExternalImageHtml({
                imageUrl,
                alt: this.optionalString(args.alt),
                caption: this.optionalString(args.caption),
                width: this.optionalString(args.width),
                align: this.optionalString(args.align),
            });

            const update = await this.appendTextIdeviceRichHtml({
                componentId,
                html: imageHtml,
                position: args.position,
            });

            return {
                componentId,
                imageUrl,
                mode: 'external_url',
                warning:
                    'Image could not be uploaded to the file manager; inserted as external URL in text content.',
                insertError: String(error?.message || error || 'Unknown error'),
                insertedHtml: imageHtml,
                update,
            };
        }
    }

    async deleteComponent(args) {
        const bridge = this.getBridge();
        const componentId = this.requireString(args.componentId, 'componentId');
        const deleted = bridge.deleteComponent(componentId);

        await this.refreshStructure(this.getSelectedPageId());
        return { componentId, deleted };
    }

    async uploadAssetFromBase64(args) {
        const bridge = this.getBridge();
        const filename = this.requireString(args.filename, 'filename');
        const base64 = this.requireString(args.base64, 'base64');
        const mimeType = this.optionalString(args.mimeType) || 'application/octet-stream';
        const folderPath = this.optionalString(args.folderPath) || '';

        if (!bridge.assetManager) {
            throw new Error('AssetManager is not available');
        }

        const bytes = this.base64ToUint8Array(base64);
        let file;

        if (typeof File !== 'undefined') {
            file = new File([bytes], filename, { type: mimeType });
        } else {
            file = new Blob([bytes], { type: mimeType });
            file.name = filename;
        }

        const assetUrl = await bridge.assetManager.insertImage(file, {
            folderPath,
        });

        return {
            filename,
            folderPath,
            assetUrl,
            assetId: bridge.assetManager.extractAssetId(assetUrl),
        };
    }

    async uploadAssetFromDataUrl(args) {
        const filename = this.requireString(args.filename, 'filename');
        const dataUrl = this.requireDataUrl(args.dataUrl);
        const folderPath = this.optionalString(args.folderPath) || '';
        const mimeType = this.detectDataUrlMimeType(dataUrl) || this.detectMimeType(filename);
        const bytes = this.base64ToUint8Array(dataUrl);
        const file = this.createFileFromBytes(bytes, filename, mimeType);

        return this.insertAssetFromFile(file, folderPath);
    }

    async importAssetFromUrl(args) {
        const imageUrl = this.resolveImageUrlFromInput(args.imageUrl, {
            picsumSeed: args.picsumSeed,
            picsumWidth: args.picsumWidth,
            picsumHeight: args.picsumHeight,
            allowTextAsPicsumSeed: true,
        });
        const folderPath = this.optionalString(args.folderPath) || '';
        const response = await fetch(imageUrl);

        if (!response.ok) {
            throw new Error(
                `Could not fetch image URL (${response.status} ${response.statusText})`,
            );
        }

        const blob = await response.blob();
        if (!blob || blob.size <= 0) {
            throw new Error('Downloaded image is empty');
        }

        const filename =
            this.optionalString(args.filename) ||
            this.filenameFromImageUrl(imageUrl, blob.type);
        const mimeType =
            this.optionalString(args.mimeType) || blob.type || this.detectMimeType(filename);
        const file = this.createFileFromBlob(blob, filename, mimeType);
        const asset = await this.insertAssetFromFile(file, folderPath);

        return {
            imageUrl,
            ...asset,
        };
    }

    async listAssets(args = {}) {
        const bridge = this.getBridge();
        if (!bridge.assetManager) {
            throw new Error('AssetManager is not available');
        }

        const folderPath = this.optionalString(args.folderPath);
        const assets =
            folderPath === null
                ? await bridge.assetManager.getProjectAssets({ includeBlobs: false })
                : await bridge.assetManager.getAssetsInFolder(folderPath);

        const normalizedAssets = assets.map((asset) => ({
            id: asset.id,
            filename: asset.filename || '',
            folderPath: asset.folderPath || '',
            mime: asset.mime || '',
            size: asset.size || 0,
            uploaded: asset.uploaded === true,
            createdAt: asset.createdAt || '',
            assetUrl: this.getAssetUrlFromIdOrMetadata(asset.id, asset),
        }));

        const subfolders =
            folderPath === null
                ? await bridge.assetManager.getSubfolders('')
                : await bridge.assetManager.getSubfolders(folderPath);

        return {
            folderPath: folderPath || '',
            count: normalizedAssets.length,
            subfolders,
            assets: normalizedAssets,
        };
    }

    async insertTextIdeviceImageFromAsset(args) {
        const componentId = this.requireString(args.componentId, 'componentId');
        this.requireTextIdeviceComponent(componentId);

        const assetUrl = this.resolveAssetUrlFromArgs(args);
        const imageHtml = this.buildTextImageHtml({
            assetUrl,
            alt: this.optionalString(args.alt),
            caption: this.optionalString(args.caption),
            width: this.optionalString(args.width),
            align: this.optionalString(args.align),
        });

        const update = await this.appendTextIdeviceRichHtml({
            componentId,
            html: imageHtml,
            position: args.position,
        });

        return {
            componentId,
            assetUrl,
            insertedHtml: imageHtml,
            update,
        };
    }

    async insertAssetFromFile(file, folderPath = '') {
        const bridge = this.getBridge();
        if (!bridge.assetManager) {
            throw new Error('AssetManager is not available');
        }

        const assetUrl = await bridge.assetManager.insertImage(file, {
            folderPath,
        });

        return {
            filename: file.name,
            folderPath,
            assetUrl,
            assetId: bridge.assetManager.extractAssetId(assetUrl),
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
        };
    }

    async saveProject() {
        const bridge = this.getBridge();
        return bridge.save({ showProgress: false });
    }

    getBridge() {
        const bridge = this.app?.project?._yjsBridge;
        if (!bridge || !bridge.structureBinding) {
            throw new Error('Project is not ready yet');
        }
        return bridge;
    }

    getStructureBinding() {
        return this.getBridge().structureBinding;
    }

    getSelectedPageId() {
        const selectedNode =
            this.app?.project?.structure?.menuStructureBehaviour?.nodeSelected;
        if (!selectedNode || typeof selectedNode.getAttribute !== 'function') {
            return null;
        }
        return selectedNode.getAttribute('nav-id');
    }

    requirePageId(pageId) {
        const id = this.optionalString(pageId) || this.getSelectedPageId();
        if (!id) {
            throw new Error('pageId is required (or select a page in the editor)');
        }
        return id;
    }

    requireTextIdeviceComponent(componentId) {
        const component = this.getStructureBinding().getComponent(componentId);
        if (!component) {
            throw new Error(`Component not found: ${componentId}`);
        }

        if (!this.isTextIdeviceComponent(component)) {
            throw new Error(
                `Component ${componentId} is not a text iDevice (type: ${component.ideviceType || 'unknown'})`,
            );
        }

        return component;
    }

    isTextIdeviceComponent(component) {
        return this.isTextIdeviceType(component?.ideviceType);
    }

    isTextIdeviceType(ideviceType) {
        const type = String(ideviceType || '').toLowerCase();
        return type.includes('text');
    }

    requireString(value, fieldName) {
        if (typeof value !== 'string' || value.trim().length === 0) {
            throw new Error(`${fieldName} is required`);
        }
        return value;
    }

    optionalString(value) {
        if (typeof value !== 'string') {
            return null;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    optionalNumber(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }

        if (typeof value === 'string' && value.trim().length > 0) {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }

        return null;
    }

    optionalBoolean(value, defaultValue = false) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
            if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
        }
        return defaultValue;
    }

    resolveWriteConfirmationPolicy(value) {
        const normalized = this.optionalString(value)?.toLowerCase();
        if (normalized === 'per-action' || normalized === 'per_action') {
            return 'per_action';
        }
        if (normalized === 'none' || normalized === 'off' || normalized === 'disabled') {
            return 'none';
        }
        if (normalized === 'session' || normalized === 'once') {
            return 'session';
        }
        return 'session';
    }

    normalizeMetadataValue(value) {
        if (typeof value !== 'string') return '';
        return value.trim();
    }

    parseJsonObject(value, fieldName = 'jsonProperties') {
        if (!value) return {};
        if (typeof value === 'object') {
            if (Array.isArray(value)) {
                throw new Error(`${fieldName} must be a JSON object`);
            }
            return { ...value };
        }
        if (typeof value !== 'string') {
            return {};
        }

        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return { ...parsed };
            }
            throw new Error(`${fieldName} must be a JSON object`);
        } catch {
            throw new Error(`${fieldName} is not valid JSON`);
        }
    }

    buildTextIdeviceJsonProperties(html, existingJson = null) {
        let properties = {};
        try {
            properties = this.parseJsonObject(existingJson);
        } catch {
            properties = {};
        }
        properties.textTextarea = html;
        return properties;
    }

    getMissingRequiredMetadataFields(metadata) {
        const missing = [];
        if (!metadata.title) missing.push('title');
        if (!metadata.author) missing.push('author');
        if (!metadata.description) missing.push('description');
        return missing;
    }

    listIdeviceIcons() {
        const icons = this.getThemeIconsList();
        return {
            count: icons.length,
            icons,
        };
    }

    getThemeIconsList() {
        const themeIcons =
            this.app?.themes?.getThemeIcons?.() ||
            window.eXeLearning?.app?.themes?.getThemeIcons?.() ||
            {};
        const entries = Object.entries(themeIcons).map(([key, icon]) => ({
            key,
            id: this.normalizeMetadataValue(icon?.id || key),
            title: this.normalizeMetadataValue(icon?.title || key),
            value: this.normalizeMetadataValue(icon?.value || ''),
        }));

        return entries.sort((a, b) => a.key.localeCompare(b.key));
    }

    resolveOptionalIconName(iconName) {
        const requested = this.optionalString(iconName);
        if (!requested) {
            return null;
        }

        const icons = this.getThemeIconsList();
        const exactKey = icons.find((icon) => icon.key === requested);
        if (exactKey) {
            return exactKey.key;
        }

        const byId = icons.find((icon) => icon.id === requested);
        if (byId) {
            return byId.key;
        }

        throw new Error(
            `iconName "${requested}" is not available in the current theme. Use exe.idevices.icons.list to inspect valid icons.`,
        );
    }

    normalizeInsertPosition(value) {
        const raw = this.optionalString(value);
        if (!raw) return 'append';
        const normalized = raw.toLowerCase();
        if (normalized === 'append' || normalized === 'after') {
            return 'append';
        }
        if (normalized === 'prepend' || normalized === 'before') {
            return 'prepend';
        }
        if (normalized === 'replace') {
            return normalized;
        }
        throw new Error('position must be append/after, prepend/before or replace');
    }

    mergeHtmlContent(currentHtml, fragment, position) {
        if (position === 'replace') {
            return fragment;
        }
        if (position === 'prepend') {
            return `${fragment}${currentHtml || ''}`;
        }
        return `${currentHtml || ''}${fragment}`;
    }

    createFileFromBytes(bytes, filename, mimeType) {
        if (typeof File !== 'undefined') {
            return new File([bytes], filename, { type: mimeType });
        }

        const blob = new Blob([bytes], { type: mimeType });
        blob.name = filename;
        return blob;
    }

    createFileFromBlob(blob, filename, mimeType) {
        if (typeof File !== 'undefined') {
            return new File([blob], filename, {
                type: mimeType || blob.type || 'application/octet-stream',
            });
        }

        if (mimeType && blob.type !== mimeType) {
            const rewritten = new Blob([blob], { type: mimeType });
            rewritten.name = filename;
            return rewritten;
        }
        blob.name = filename;
        return blob;
    }

    buildTextImageHtml(options = {}) {
        const assetUrl = this.requireString(options.assetUrl, 'assetUrl');
        const assetId = this.getBridge().assetManager.extractAssetId(assetUrl);
        const alt = this.escapeHtml(this.optionalString(options.alt) || '');
        const caption = this.optionalString(options.caption);
        const escapedCaption = caption ? this.escapeHtml(caption) : '';
        const width = this.normalizeCssSize(options.width);
        const alignClass = this.normalizeImageAlign(options.align);

        const figureClassAttr = alignClass ? ` class="${alignClass}"` : '';
        const widthAttr = width ? ` style="max-width:${width};"` : '';
        const captionHtml = escapedCaption
            ? `<figcaption>${escapedCaption}</figcaption>`
            : '';

        return `<figure${figureClassAttr}><img src="${assetUrl}" alt="${alt}" data-asset-id="${assetId}"${widthAttr}>${captionHtml}</figure>`;
    }

    buildTextExternalImageHtml(options = {}) {
        const imageUrl = this.requireHttpImageUrl(options.imageUrl);
        const alt = this.escapeHtml(this.optionalString(options.alt) || '');
        const caption = this.optionalString(options.caption);
        const escapedCaption = caption ? this.escapeHtml(caption) : '';
        const width = this.normalizeCssSize(options.width);
        const alignClass = this.normalizeImageAlign(options.align);

        const figureClassAttr = alignClass ? ` class="${alignClass}"` : '';
        const widthAttr = width ? ` style="max-width:${width};"` : '';
        const captionHtml = escapedCaption
            ? `<figcaption>${escapedCaption}</figcaption>`
            : '';

        return `<figure${figureClassAttr}><img src="${this.escapeHtml(imageUrl)}" alt="${alt}"${widthAttr}>${captionHtml}</figure>`;
    }

    resolveAssetUrlFromArgs(args = {}) {
        const directAssetUrl = this.optionalString(args.assetUrl);
        if (directAssetUrl) {
            if (!directAssetUrl.startsWith('asset://')) {
                throw new Error('assetUrl must start with asset://');
            }
            return directAssetUrl;
        }

        const assetId = this.optionalString(args.assetId);
        if (!assetId) {
            throw new Error('Provide assetUrl or assetId');
        }

        return this.getAssetUrlFromIdOrMetadata(assetId);
    }

    getAssetUrlFromIdOrMetadata(assetId, metadata = null) {
        const bridge = this.getBridge();
        const manager = bridge.assetManager;
        if (!manager) {
            throw new Error('AssetManager is not available');
        }

        const id = this.requireString(assetId, 'assetId');
        const meta = metadata || manager.getAssetMetadata?.(id) || null;
        const filename = this.optionalString(meta?.filename) || '';

        if (typeof manager.getAssetUrl === 'function') {
            return manager.getAssetUrl(id, filename);
        }

        return filename ? `asset://${id}.${this.getFileExtension(filename)}` : `asset://${id}`;
    }

    resolveImageUrlFromInput(value, options = {}) {
        const raw = this.optionalString(value);
        if (raw) {
            const parsed = this.tryParseHttpImageUrl(raw);
            if (parsed) {
                return parsed;
            }

            if (!this.optionalBoolean(options.allowTextAsPicsumSeed, false)) {
                throw new Error('imageUrl must be a valid absolute URL (http/https)');
            }

            return this.buildPicsumImageUrl(raw, options.picsumWidth, options.picsumHeight);
        }

        const picsumSeed = this.optionalString(options.picsumSeed);
        if (!picsumSeed) {
            throw new Error('imageUrl is required (or provide picsumSeed)');
        }

        return this.buildPicsumImageUrl(
            picsumSeed,
            options.picsumWidth,
            options.picsumHeight,
        );
    }

    buildPicsumImageUrl(seed, width, height) {
        const normalizedSeed = this.optionalString(seed) || `img-${Date.now()}`;
        const normalizedWidth = this.clampNumber(
            this.optionalNumber(width),
            64,
            4096,
            1280,
        );
        const normalizedHeight = this.clampNumber(
            this.optionalNumber(height),
            64,
            4096,
            720,
        );
        return `https://picsum.photos/seed/${encodeURIComponent(
            normalizedSeed,
        )}/${normalizedWidth}/${normalizedHeight}`;
    }

    tryParseHttpImageUrl(value) {
        try {
            const parsed = new URL(String(value));
            const protocol = parsed.protocol.toLowerCase();
            if (protocol !== 'http:' && protocol !== 'https:') {
                return null;
            }
            return parsed.toString();
        } catch {
            return null;
        }
    }

    requireHttpImageUrl(value) {
        const parsed = this.tryParseHttpImageUrl(value);
        if (!parsed) {
            throw new Error('imageUrl must be a valid absolute URL (http/https)');
        }
        return parsed;
    }

    requireDataUrl(value) {
        const raw = this.requireString(value, 'dataUrl');
        if (!/^data:[^;]+;base64,/.test(raw)) {
            throw new Error('dataUrl must be a valid base64 data URL');
        }
        return raw;
    }

    detectDataUrlMimeType(dataUrl) {
        if (typeof dataUrl !== 'string') return '';
        const match = dataUrl.match(/^data:([^;]+);base64,/i);
        return match && match[1] ? match[1].toLowerCase() : '';
    }

    normalizeImageAlign(value) {
        const raw = this.optionalString(value);
        if (!raw) return '';
        const normalized = raw.toLowerCase();
        if (normalized === 'left') return 'exe-image-left';
        if (normalized === 'right') return 'exe-image-right';
        if (normalized === 'center') return 'exe-image-center';
        if (normalized === 'inline') return 'exe-image-inline';
        return '';
    }

    normalizeCssSize(value) {
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
            return `${value}px`;
        }
        if (typeof value !== 'string') return '';

        const trimmed = value.trim();
        if (!trimmed) return '';
        if (/^\d+(\.\d+)?(px|%|rem|em|vw|vh)?$/i.test(trimmed)) {
            if (/^\d+(\.\d+)?$/i.test(trimmed)) {
                return `${trimmed}px`;
            }
            return trimmed;
        }
        return '';
    }

    escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    detectMimeType(filename) {
        const ext = this.getFileExtension(filename);
        const map = {
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            webp: 'image/webp',
            gif: 'image/gif',
            svg: 'image/svg+xml',
            avif: 'image/avif',
        };
        return map[ext] || 'application/octet-stream';
    }

    filenameFromImageUrl(imageUrl, mimeType = '') {
        try {
            const parsed = new URL(imageUrl);
            const raw = decodeURIComponent(parsed.pathname.split('/').pop() || '');
            const safe = this.sanitizeFilename(raw);
            if (safe && this.getFileExtension(safe)) {
                return safe;
            }
            const ext = this.extensionFromMimeType(mimeType) || 'png';
            const name = safe || `internet-image-${Date.now()}`;
            return this.getFileExtension(name) ? name : `${name}.${ext}`;
        } catch {
            const ext = this.extensionFromMimeType(mimeType) || 'png';
            return `internet-image-${Date.now()}.${ext}`;
        }
    }

    sanitizeFilename(value) {
        if (typeof value !== 'string') return '';
        const cleaned = value.replace(/[\\/:*?"<>|]/g, '-').trim();
        return cleaned.slice(0, 120);
    }

    getFileExtension(filename) {
        if (typeof filename !== 'string') return '';
        const parts = filename.toLowerCase().split('.');
        return parts.length > 1 ? parts.pop() : '';
    }

    extensionFromMimeType(mimeType) {
        const map = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/webp': 'webp',
            'image/gif': 'gif',
            'image/svg+xml': 'svg',
            'image/avif': 'avif',
        };
        return map[String(mimeType || '').toLowerCase()] || '';
    }

    base64ToUint8Array(base64) {
        const normalized = base64.includes(',')
            ? base64.substring(base64.indexOf(',') + 1)
            : base64;

        const binary = atob(normalized);
        const len = binary.length;
        const bytes = new Uint8Array(len);

        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        return bytes;
    }

    async refreshStructure(pageId) {
        const selectedBefore = this.getSelectedPageId();
        const target = pageId || this.getSelectedPageId();
        if (
            this.app?.project?.structure &&
            typeof this.app.project.structure.resetStructureData === 'function'
        ) {
            await this.app.project.structure.resetStructureData(target);
        }

        // If the update happened in the currently selected page, force a content reload.
        // MenuStructureBehaviour.selectNode skips loadApiIdevicesInPage when selecting the same node.
        if (target && selectedBefore && target === selectedBefore) {
            await this.forceReloadPageContent(target);
        }
    }

    getNavElementByPageId(pageId) {
        if (!pageId) return null;
        const safeId = String(pageId).replace(/"/g, '\\"');

        const fromStructureMenu =
            this.app?.project?.structure?.menuStructureCompose?.menuNav?.querySelector?.(
                `.nav-element[nav-id="${safeId}"]`,
            );
        if (fromStructureMenu) {
            return fromStructureMenu;
        }

        return document.querySelector(`.nav-element[nav-id="${safeId}"]`);
    }

    async forceReloadPageContent(pageId) {
        const loadPage = this.app?.project?.idevices?.loadApiIdevicesInPage;
        if (typeof loadPage !== 'function') {
            return;
        }

        const navElement = this.getNavElementByPageId(pageId);
        if (!navElement) {
            return;
        }

        await loadPage.call(this.app.project.idevices, false, navElement);

        const checkIfEmptyNode =
            this.app?.menus?.menuStructure?.menuStructureBehaviour?.checkIfEmptyNode;
        if (typeof checkIfEmptyNode === 'function') {
            checkIfEmptyNode.call(this.app.menus.menuStructure.menuStructureBehaviour);
        }
    }
}
