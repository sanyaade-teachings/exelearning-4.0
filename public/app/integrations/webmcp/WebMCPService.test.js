import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebMCPService from './WebMCPService.js';

class FakeWebMCP {
    constructor() {
        this.tools = [];
    }

    registerTool(name) {
        this.tools.push(name);
    }
}

describe('WebMCPService', () => {
    let service;
    const originalModelContext = navigator.modelContext;

    beforeEach(() => {
        window.eXeLearning = { config: {} };
        service = new WebMCPService({
            composeUrl: (path) => `/base/${path}`,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete window.WebMCP;
        delete window.eXeLearning;
        Object.defineProperty(navigator, 'modelContext', {
            configurable: true,
            writable: true,
            value: originalModelContext,
        });
    });

    it('builds script candidates from config and defaults', () => {
        window.eXeLearning.config.webmcpScriptUrl = 'https://one.example/webmcp.js';
        window.eXeLearning.config.webmcpScriptUrls = [
            'https://two.example/webmcp.js',
            'https://three.example/webmcp.js',
        ];

        const candidates = service.getScriptCandidates();

        expect(candidates).toContain('https://one.example/webmcp.js');
        expect(candidates).toContain('https://two.example/webmcp.js');
        expect(candidates).toContain('https://three.example/webmcp.js');
        expect(candidates).toContain('/base/libs/webmcp/webmcp.js');
        expect(candidates).toContain('/base/webmcp.js');
        expect(candidates).toContain('https://webmcp.dev/src/webmcp.js');
        expect(candidates).toContain(
            'https://cdn.jsdelivr.net/npm/@jason.today/webmcp@latest/build/webmcp.js',
        );
        expect(candidates).toContain(
            'https://unpkg.com/@jason.today/webmcp@latest/build/webmcp.js',
        );
    });

    it('initializes directly when window.WebMCP is already available', async () => {
        window.WebMCP = FakeWebMCP;

        const ready = await service.init();

        expect(ready).toBe(true);
        expect(service.isReady()).toBe(true);
        expect(service.getRegisteredTools().length).toBeGreaterThan(0);
        expect(service.getStatus().label).toBe('Ready');
    });

    it('prefers native browser WebMCP when navigator.modelContext is available', async () => {
        const registerTool = vi.fn();
        Object.defineProperty(navigator, 'modelContext', {
            configurable: true,
            writable: true,
            value: { registerTool },
        });
        window.WebMCP = FakeWebMCP;

        const ready = await service.init();

        expect(ready).toBe(true);
        expect(service.isReady()).toBe(true);
        expect(service.canOpenWidget()).toBe(false);
        expect(service.getStatus().label).toBe('Ready (native WebMCP)');
        expect(registerTool).toHaveBeenCalled();
        expect(registerTool.mock.calls[0][0]).toHaveProperty('name');
    });

    it('loads script and initializes when WebMCP is missing', async () => {
        vi.spyOn(service, 'getScriptCandidates').mockReturnValue([
            'https://example.com/webmcp.js',
        ]);

        vi.spyOn(document.head, 'append').mockImplementation((script) => {
            window.WebMCP = FakeWebMCP;
            script.onload();
            return script;
        });

        const ready = await service.ensureReady();

        expect(ready).toBe(true);
        expect(service.isReady()).toBe(true);
        expect(service.loadedScriptUrl).toBe('https://example.com/webmcp.js');
    });

    it('returns error state when script cannot be loaded', async () => {
        vi.spyOn(service, 'getScriptCandidates').mockReturnValue([
            'https://example.com/missing-webmcp.js',
        ]);

        vi.spyOn(document.head, 'append').mockImplementation((script) => {
            script.onerror();
            return script;
        });

        const ready = await service.ensureReady();
        const status = service.getStatus();

        expect(ready).toBe(false);
        expect(service.isReady()).toBe(false);
        expect(status.label).toBe('Error');
        expect(status.description).toContain('Failed to load WebMCP script');
    });

    it('asks write confirmation once per session by default', () => {
        window.confirm = vi.fn(() => true);

        expect(service.confirmWriteAction('exe.pages.create')).toBe(true);
        expect(service.confirmWriteAction('exe.project.save')).toBe(true);

        expect(window.confirm).toHaveBeenCalledTimes(1);
    });

    it('reuses initial blank page when creating first root page', async () => {
        const bridge = {
            structureBinding: {
                getPages: vi.fn(() => [
                    {
                        id: 'page-initial',
                        pageId: 'page-initial',
                        pageName: 'New page',
                        parentId: null,
                        order: 0,
                        blockCount: 0,
                    },
                ]),
            },
            updatePage: vi.fn(),
            getPage: vi.fn(() => ({
                id: 'page-initial',
                pageId: 'page-initial',
                pageName: 'Introducción',
                parentId: null,
                order: 0,
                blockCount: 0,
            })),
            addPage: vi.fn(),
            movePage: vi.fn(),
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });
        vi.spyOn(service, 'refreshStructure').mockResolvedValue(undefined);

        const result = await service.createPage({ name: 'Introducción' });

        expect(bridge.updatePage).toHaveBeenCalledWith('page-initial', {
            pageName: 'Introducción',
            title: 'Introducción',
        });
        expect(bridge.addPage).not.toHaveBeenCalled();
        expect(result.reusedInitialPage).toBe(true);
    });

    it('validates required project metadata fields', () => {
        const bridge = {
            structureBinding: {
                getPages: () => [],
            },
            getMetadata: vi.fn(() => ({
                title: 'Course title',
                author: '',
                description: 'Course description',
            })),
            updateMetadata: vi.fn(),
        };
        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });

        expect(() => service.ensureProjectMetadata({})).toThrow(
            'Project metadata is incomplete',
        );
        expect(bridge.updateMetadata).not.toHaveBeenCalled();
    });

    it('creates text iDevice enforcing block title and valid icon', async () => {
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => ({ id: 'component-1', ideviceType: 'text' })),
            updateBlock: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            getMetadata: vi.fn(() => ({
                title: 'Project',
                author: 'Author',
                description: 'Description',
            })),
            updateMetadata: vi.fn(),
            addBlock: vi.fn(() => 'block-1'),
            addComponent: vi.fn(() => 'component-1'),
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
            themes: {
                getThemeIcons: vi.fn(() => ({
                    idea: { id: 'idea', title: 'Idea', value: '/icons/idea.svg' },
                })),
            },
        });

        const result = await service.addTextIdevice({
            pageId: 'page-1',
            blockName: 'Resumen',
            iconName: 'idea',
            html: '<p>Hola</p>',
        });

        expect(result.blockId).toBe('block-1');
        expect(result.iconName).toBe('idea');
        expect(binding.updateBlock).toHaveBeenCalledWith('block-1', {
            blockName: 'Resumen',
            iconName: 'idea',
        });
        expect(bridge.addComponent).toHaveBeenCalledTimes(1);
        const addComponentArgs = bridge.addComponent.mock.calls[0];
        expect(addComponentArgs[2]).toBe('text');
        expect(addComponentArgs[3].htmlView).toBe('<p>Hola</p>');
        expect(JSON.parse(addComponentArgs[3].jsonProperties).textTextarea).toBe('<p>Hola</p>');
    });

    it('creates az-quiz-game iDevice with words and definitions', async () => {
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => ({ id: 'component-rosco', ideviceType: 'az-quiz-game' })),
            updateBlock: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            getMetadata: vi.fn(() => ({
                title: 'Project',
                author: 'Author',
                description: 'Description',
            })),
            updateMetadata: vi.fn(),
            addBlock: vi.fn(() => 'block-rosco'),
            addComponent: vi.fn(() => 'component-rosco'),
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
            themes: {
                getThemeIcons: vi.fn(() => ({
                    activity: { id: 'activity', title: 'Activity', value: '/icons/activity.svg' },
                })),
            },
        });

        const result = await service.addAzQuizGameIdevice({
            pageId: 'page-1',
            blockName: 'Rosco',
            iconName: 'activity',
            entries: [
                {
                    word: 'Fotosintesis',
                    definition: 'Proceso por el que las plantas producen alimento',
                },
            ],
        });

        expect(result.blockId).toBe('block-rosco');
        expect(result.entriesCount).toBe(1);
        expect(bridge.addComponent).toHaveBeenCalledTimes(1);
        const addComponentArgs = bridge.addComponent.mock.calls[0];
        expect(addComponentArgs[2]).toBe('az-quiz-game');
        expect(addComponentArgs[3].htmlContent).toContain('rosco-DataGame');
        const jsonPayload = JSON.parse(addComponentArgs[3].jsonProperties);
        expect(jsonPayload.dataGame.typeGame).toBe('Rosco');
        expect(jsonPayload.dataGame.letters).toBe('F');
        expect(jsonPayload.dataGame.wordsGame[0].word).toBe('Fotosintesis');
        expect(jsonPayload.dataGame.wordsGame[0].definition).toContain('plantas');
    });

    it('rejects duplicate letters in az-quiz-game entries', async () => {
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => ({ id: 'component-rosco', ideviceType: 'az-quiz-game' })),
            updateBlock: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            getMetadata: vi.fn(() => ({
                title: 'Project',
                author: 'Author',
                description: 'Description',
            })),
            updateMetadata: vi.fn(),
            addBlock: vi.fn(() => 'block-rosco'),
            addComponent: vi.fn(() => 'component-rosco'),
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });

        await expect(
            service.addAzQuizGameIdevice({
                pageId: 'page-1',
                blockName: 'Rosco',
                entries: [
                    { letter: 'A', word: 'Arbol', definition: 'Planta leñosa' },
                    { letter: 'A', word: 'Agua', definition: 'H2O' },
                ],
            }),
        ).rejects.toThrow('duplicate letter');
    });

    it('creates image-gallery iDevice from urls and picsum seed', async () => {
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => ({ id: 'component-gallery', ideviceType: 'image-gallery' })),
            updateBlock: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            getMetadata: vi.fn(() => ({
                title: 'Project',
                author: 'Author',
                description: 'Description',
            })),
            updateMetadata: vi.fn(),
            addBlock: vi.fn(() => 'block-gallery'),
            addComponent: vi.fn(() => 'component-gallery'),
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });

        const result = await service.addImageGalleryIdevice({
            pageId: 'page-1',
            blockName: 'Galería',
            images: [
                { imageUrl: 'https://example.com/a.jpg', title: 'A' },
                { picsumSeed: 'bosque', title: 'Bosque' },
            ],
        });

        expect(result.imagesCount).toBe(2);
        const addComponentArgs = bridge.addComponent.mock.calls[0];
        expect(addComponentArgs[2]).toBe('image-gallery');
        const jsonPayload = JSON.parse(addComponentArgs[3].jsonProperties);
        expect(jsonPayload.img_0.img).toBe('https://example.com/a.jpg');
        expect(jsonPayload.img_1.img).toContain('https://picsum.photos/seed/bosque/');
    });

    it('creates form iDevice with structured questions', async () => {
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => ({ id: 'component-form', ideviceType: 'form' })),
            updateBlock: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            getMetadata: vi.fn(() => ({
                title: 'Project',
                author: 'Author',
                description: 'Description',
            })),
            updateMetadata: vi.fn(),
            addBlock: vi.fn(() => 'block-form'),
            addComponent: vi.fn(() => 'component-form'),
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });

        const result = await service.addFormIdevice({
            pageId: 'page-1',
            blockName: 'Formulario',
            instructions: '<p>Responde todas las preguntas</p>',
            questions: [
                {
                    activityType: 'selection',
                    baseText: '<p>¿Qué gas liberan las plantas?</p>',
                    answers: [
                        { text: 'Oxígeno', correct: true },
                        { text: 'Nitrógeno', correct: false },
                    ],
                },
            ],
        });

        expect(result.questionsCount).toBe(1);
        const addComponentArgs = bridge.addComponent.mock.calls[0];
        expect(addComponentArgs[2]).toBe('form');
        const jsonPayload = JSON.parse(addComponentArgs[3].jsonProperties);
        expect(jsonPayload.eXeFormInstructions).toContain('Responde');
        expect(jsonPayload.questionsData[0].activityType).toBe('selection');
        expect(jsonPayload.questionsData[0].answers[0][0]).toBe(true);
    });

    it('rejects unknown icon names', async () => {
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => ({ id: 'component-1', ideviceType: 'text' })),
            updateBlock: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            getMetadata: vi.fn(() => ({
                title: 'Project',
                author: 'Author',
                description: 'Description',
            })),
            updateMetadata: vi.fn(),
            addBlock: vi.fn(() => 'block-1'),
            addComponent: vi.fn(() => 'component-1'),
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
            themes: {
                getThemeIcons: vi.fn(() => ({
                    info: { id: 'info', title: 'Info', value: '/icons/info.svg' },
                })),
            },
        });

        await expect(
            service.addTextIdevice({
                pageId: 'page-1',
                blockName: 'Resumen',
                iconName: 'unknown-icon',
            }),
        ).rejects.toThrow('iconName "unknown-icon" is not available');
    });

    it('rejects invalid jsonProperties when creating generic component', async () => {
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            addComponent: vi.fn(() => 'component-1'),
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });
        vi.spyOn(service, 'refreshStructure').mockResolvedValue(undefined);

        await expect(
            service.createComponent({
                pageId: 'page-1',
                blockId: 'block-1',
                ideviceType: 'text',
                title: 'Unsafe',
                html: '<p>Hola</p>',
                jsonProperties: '{"broken": true',
            }),
        ).rejects.toThrow('jsonProperties is not valid JSON');

        expect(bridge.addComponent).not.toHaveBeenCalled();
    });

    it('normalizes valid jsonProperties string when creating generic component', async () => {
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => ({ id: 'component-1', ideviceType: 'text' })),
        };
        const bridge = {
            structureBinding: binding,
            addComponent: vi.fn(() => 'component-1'),
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });
        vi.spyOn(service, 'refreshStructure').mockResolvedValue(undefined);

        await service.createComponent({
            pageId: 'page-1',
            blockId: 'block-1',
            ideviceType: 'crossword',
            title: 'Safe',
            html: '<p>Hola</p>',
            jsonProperties: '{"foo":"bar","count":1}',
        });

        expect(bridge.addComponent).toHaveBeenCalledTimes(1);
        const initialData = bridge.addComponent.mock.calls[0][3];
        expect(initialData.jsonProperties).toBe('{"foo":"bar","count":1}');
    });

    it('keeps text iDevice JSON in sync when setting rich html', async () => {
        const component = {
            id: 'component-1',
            ideviceType: 'text',
            htmlContent: '<p>Old</p>',
            jsonProperties: '{"foo":"bar","textTextarea":"<p>Old</p>"}',
        };
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => component),
            updateComponent: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });

        await service.setTextIdeviceRichHtml({
            componentId: 'component-1',
            html: '<p>Nuevo</p>',
        });

        expect(binding.updateComponent).toHaveBeenCalledTimes(1);
        const updatePayload = binding.updateComponent.mock.calls[0][1];
        expect(updatePayload.htmlContent).toBe('<p>Nuevo</p>');
        expect(updatePayload.htmlView).toBe('<p>Nuevo</p>');
        const jsonPayload = JSON.parse(updatePayload.jsonProperties);
        expect(jsonPayload.foo).toBe('bar');
        expect(jsonPayload.textTextarea).toBe('<p>Nuevo</p>');
    });

    it('accepts after/before aliases for image insertion position', () => {
        expect(service.normalizeInsertPosition('after')).toBe('append');
        expect(service.normalizeInsertPosition('before')).toBe('prepend');
    });

    it('falls back to external image URL when fetch fails', async () => {
        const component = {
            id: 'component-1',
            ideviceType: 'text',
            htmlContent: '<p>Base</p>',
            jsonProperties: '{"textTextarea":"<p>Base</p>"}',
        };
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => component),
            updateComponent: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            assetManager: {
                extractAssetId: vi.fn(() => 'asset-id'),
            },
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });

        global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

        const result = await service.insertTextIdeviceImageFromUrl({
            componentId: 'component-1',
            imageUrl: 'https://example.com/photo.png',
            caption: 'Perro con flor',
            position: 'after',
        });

        expect(result.mode).toBe('external_url');
        expect(binding.updateComponent).toHaveBeenCalledTimes(1);
        const payload = binding.updateComponent.mock.calls[0][1];
        expect(payload.htmlContent).toContain('<img src="https://example.com/photo.png"');
        const jsonPayload = JSON.parse(payload.jsonProperties);
        expect(jsonPayload.textTextarea).toContain('https://example.com/photo.png');
    });

    it('builds picsum URL when imageUrl is missing in text image insertion', async () => {
        const component = {
            id: 'component-1',
            ideviceType: 'text',
            htmlContent: '<p>Base</p>',
            jsonProperties: '{"textTextarea":"<p>Base</p>"}',
        };
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => component),
            updateComponent: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            assetManager: {
                extractAssetId: vi.fn(() => 'asset-id'),
            },
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });

        global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

        const result = await service.insertTextIdeviceImageFromUrl({
            componentId: 'component-1',
            picsumSeed: 'fotosintesis',
            picsumWidth: 800,
            picsumHeight: 500,
            position: 'after',
        });

        expect(result.mode).toBe('external_url');
        expect(result.imageUrl).toContain('https://picsum.photos/seed/fotosintesis/800/500');
        const payload = binding.updateComponent.mock.calls[0][1];
        expect(payload.htmlContent).toContain('picsum.photos/seed/fotosintesis/800/500');
    });

    it('imports image URL into file manager assets', async () => {
        const bridge = {
            structureBinding: {
                getPages: vi.fn(() => []),
            },
            assetManager: {
                insertImage: vi.fn(async () => 'asset://asset-1.png'),
                extractAssetId: vi.fn(() => 'asset-1'),
            },
        };
        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });

        const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            blob: async () => blob,
        });

        const result = await service.importAssetFromUrl({
            imageUrl: 'https://example.com/image.png',
        });

        expect(result.assetUrl).toBe('asset://asset-1.png');
        expect(result.assetId).toBe('asset-1');
    });

    it('lists assets from file manager', async () => {
        const bridge = {
            structureBinding: {
                getPages: vi.fn(() => []),
            },
            assetManager: {
                getProjectAssets: vi.fn(async () => [
                    {
                        id: 'asset-1',
                        filename: 'leaf.png',
                        folderPath: 'imagenes',
                        mime: 'image/png',
                        size: 1234,
                        uploaded: false,
                        createdAt: '2026-02-21T00:00:00.000Z',
                    },
                ]),
                getSubfolders: vi.fn(async () => ['imagenes']),
                getAssetUrl: vi.fn((id, filename) => `asset://${id}.${filename.split('.').pop()}`),
            },
        };
        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });

        const result = await service.listAssets({});

        expect(result.count).toBe(1);
        expect(result.assets[0].assetUrl).toBe('asset://asset-1.png');
        expect(result.subfolders).toEqual(['imagenes']);
    });

    it('refreshes selected page content after structure reset', async () => {
        const navElement = document.createElement('div');
        navElement.className = 'nav-element';
        navElement.setAttribute('nav-id', 'page-1');
        const menuNav = document.createElement('div');
        menuNav.appendChild(navElement);

        const resetStructureData = vi.fn(async () => undefined);
        const loadApiIdevicesInPage = vi.fn(async () => undefined);
        const checkIfEmptyNode = vi.fn();

        service = new WebMCPService({
            project: {
                structure: {
                    resetStructureData,
                    menuStructureCompose: { menuNav },
                },
                idevices: {
                    loadApiIdevicesInPage,
                },
            },
            menus: {
                menuStructure: {
                    menuStructureBehaviour: {
                        checkIfEmptyNode,
                    },
                },
            },
        });

        vi.spyOn(service, 'getSelectedPageId').mockReturnValue('page-1');

        await service.refreshStructure('page-1');

        expect(resetStructureData).toHaveBeenCalledWith('page-1');
        expect(loadApiIdevicesInPage).toHaveBeenCalledWith(false, navElement);
        expect(checkIfEmptyNode).toHaveBeenCalledTimes(1);
    });

    it('does not force page content reload when target page is not selected', async () => {
        const resetStructureData = vi.fn(async () => undefined);
        const loadApiIdevicesInPage = vi.fn(async () => undefined);

        service = new WebMCPService({
            project: {
                structure: {
                    resetStructureData,
                },
                idevices: {
                    loadApiIdevicesInPage,
                },
            },
        });

        vi.spyOn(service, 'getSelectedPageId').mockReturnValue('page-selected');

        await service.refreshStructure('page-other');

        expect(resetStructureData).toHaveBeenCalledWith('page-other');
        expect(loadApiIdevicesInPage).not.toHaveBeenCalled();
    });
});
