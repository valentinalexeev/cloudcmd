/* global DOM, CloudCmd */

'use strict';

const exec = require('execon');
const itype = require('itype/legacy');
const currify = require('currify/legacy');
const getRange = require('./get-range');

const getIndex = currify(require('./get-index'));

const uploadFiles = require('../dom/upload-files');

const {
    FS,
    apiURL
} = require('../../common/cloudfunc');

module.exports.init = () => {
    contextMenu();
    dragndrop();
    unload();
    pop();
    resize();
    config();
    header();
};

CloudCmd.Listeners = module.exports;

const unselect = (event) => {
    const isMac = /Mac/.test(window.navigator.platform);
    const {
        shiftKey,
        metaKey,
        ctrlKey,
    } = event;
    
    if (shiftKey || isMac && metaKey || ctrlKey)
        return;
    
    DOM.unselectFiles();
};

const execAll = currify((funcs, event) => {
    funcs.forEach((fn) => {
        fn(event);
    });
});


const Info = DOM.CurrentInfo;
const Storage = DOM.Storage;
const Events = DOM.Events;
const EventsFiles = {
    mousedown: exec.with(execIfNotUL, setCurrentFileByEvent),
    click: execAll([onClick, unselect]),
    dragstart: exec.with(execIfNotUL, onDragStart),
    dblclick: exec.with(execIfNotUL, onDblClick),
    touchstart: exec.with(execIfNotUL, onTouch)
};

let EXT;

function header() {
    const fm = DOM.getFM();
    
    const isDataset = (el) => el.dataset;
    
    var isPanel = (el) => {
        return /^js-(left|right)$/.test(el.dataset.name);
    };
    
    Events.addClick(fm, (event) => {
        const el = event.target;
        const parent = el.parentElement;
        
        if (parent.dataset.name !== 'js-fm-header')
            return;
        
        const name = (el.dataset.name || '')
            .replace('js-', '');
        
        if (!/^(name|size|date)$/.test(name))
            return;
        
        const panel = getPath(el)
            .filter(isDataset)
            .filter(isPanel)
            .pop();
        
        CloudCmd.sortPanel(name, panel);
    });
}

function getPath(el, path = []) {
    if (!el)
        return path;
    
    return getPath(el.parentElement, path.concat(el));
}

function config() {
    DOM.Files.get('config', (e, config) => {
        const type = config && config.packer;
        EXT = DOM.getPackerExt(type);
    });
}

module.exports.initKeysPanel = () => {
    const keysElement = DOM.getById('js-keyspanel');
    
    if (!keysElement)
        return;
    
    Events.addClick(keysElement, ({target}) => {
        const id = target.id;
        const operation = (name) => {
            const Operation = CloudCmd.Operation;
            const fn = Operation.show.bind(null, name);
            
            return fn;
        };
        
        const clickFuncs = {
            'f1'        : CloudCmd.Help.show,
            'f2'        : DOM.renameCurrent,
            'f3'        : CloudCmd.View.show,
            'f4'        : CloudCmd.EditFile.show,
            'f5'        : operation('copy'),
            'f6'        : operation('move'),
            'f7'        : DOM.promptNewDir,
            'f8'        : operation('delete'),
            'f9'        : CloudCmd.Menu.show,
            'f10'       : CloudCmd.Config.show,
            '~'         : CloudCmd.Konsole.show,
            'shift~'    : CloudCmd.Terminal.show,
            'contact'   : CloudCmd.Contact.show,
        };
       
        exec(clickFuncs[id]);
    });
};

const getPanel = (side) => {
    if (!itype.string(side))
        return side;
    
    return DOM.getByDataName('js-' + side);
};

module.exports.setOnPanel = (side) => {
    const panel = getPanel(side);
    
    const filesElement = DOM.getByDataName('js-files', panel);
    const pathElement = DOM.getByDataName('js-path', panel);
    
    /* ставим загрузку гифа на клик*/
    Events.addClick(pathElement, getPathListener(panel));
    Events.add(filesElement, EventsFiles);
};

function getPathListener(panel) {
    return onPathElementClick.bind(null, panel);
}

function isNoCurrent(panel) {
    const infoPanel = Info.panel;
    const namePanel = panel.getAttribute('data-name');
    const nameInfoPanel = infoPanel.getAttribute('data-name');
        
    if (namePanel !== nameInfoPanel)
        return true;
    
    return false;
}

function onPathElementClick(panel, event) {
    let link, href, url, noCurrent;
    
    const prefix = CloudCmd.PREFIX;
    const element = event.target;
    const attr = element.getAttribute('data-name');
    
    switch (attr) {
    case 'js-clear-storage':
        Storage.clear();
        break;
    
    case 'js-refresh':
        noCurrent = isNoCurrent(panel);
        
        CloudCmd.refresh({
            panel,
            noCurrent
        });
        
        event.preventDefault();
        break;
    
    case 'js-path-link':
        url         = CloudCmd.HOST;
        href        = element.href;
        link        = href.replace(url, '');
        /**
         * browser doesn't replace % -> %25%
         * do it for him
         */
        link        = link.replace('%%', '%25%');
        link        = decodeURI(link);
        link        = link.replace(RegExp('^' + prefix + FS), '') || '/';
        
        noCurrent   = isNoCurrent(panel);
        
        CloudCmd.loadDir({
            path        : link,
            isRefresh   : false,
            panel       : noCurrent ? panel : Info.panel
        });
        
        event.preventDefault();
    }
}

function execIfNotUL(callback, event) {
    const {target} = event;
    const {tagName} = target;
    
    if (tagName !== 'UL')
        callback(event);
}

function onClick(event) {
    const ctrl = event.ctrlKey;
    
    if (!ctrl)
        event.preventDefault();
    
    changePanel(event.target);
}

function toggleSelect(key, files) {
    const isMac = /Mac/.test(window.navigator.platform);
    
    if (!key)
        throw Error('key should not be undefined!');
    
    const [file] = files;
    
    if (isMac && key.meta || key.ctrl)
        return DOM.toggleSelectedFile(file);
    
    if (key.shift)
        return files.forEach(DOM.selectFile);
}

function changePanel(element) {
    const {panel} = Info;
    const files = DOM.getByDataName('js-files', panel);
    const ul = getULElement(element);
    
    if (ul !== files)
        DOM.changePanel();
}

function onDblClick(event) {
    const current = getLIElement(event.target);
    const isDir = DOM.isCurrentIsDir(current);
    const path = DOM.getCurrentPath(current);
    
    if (isDir) {
        CloudCmd.loadDir({
            path: path === '/' ? '/' : path + '/'
        });
        
        event.preventDefault();
    }
}

function onTouch(event) {
    const current = getLIElement(event.target);
    const isDir = DOM.isCurrentIsDir(current);
    
    if (!isDir)
        return;
    
    const isCurrent = DOM.isCurrentFile(current);
    
    if (!isCurrent)
        return;
    
    CloudCmd.loadDir({
        path: DOM.getCurrentPath(current)
    });
    
    event.preventDefault();
}

/*
  * download file from browser to desktop
  * in Chrome (HTML5)
  */
function onDragStart(event) {
    const element = getLIElement(event.target);
    const isDir = Info.isDir;
    let link = DOM.getCurrentLink(element);
    let name = DOM.getCurrentName(element);
    
    /* if it's directory - adding json extension */
    if (isDir) {
        name += EXT;
        link = document.createElement('a');
        link.textContent = name;
        link.href = apiURL + '/pack' + Info.path + EXT;
    }
    
    event.dataTransfer.setData('DownloadURL',
        'application/octet-stream'  + ':' +
        name                        + ':' +
        link);
}

function getLIElement(element) {
    if (!element)
        return element;
    
    while (element.tagName !== 'LI')
        element = element.parentElement;
    
    return element;
}

function getULElement(element) {
    while (element.tagName !== 'UL')
        element = element.parentElement;
    
    return element;
}

function setCurrentFileByEvent(event) {
    const BUTTON_LEFT = 0;
    
    const key = {
        alt: event.altKey,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        shift: event.shiftKey
    };
    
    const element = getLIElement(event.target);
    
    const fromName = Info.name;
    DOM.setCurrentFile(element);
    const toName = Info.name;
    
    let files = [];
    
    if (key.shift)
        files = getFilesRange(fromName, toName);
    else
        files.push(Info.element);
    
    if (event.button === BUTTON_LEFT)
        toggleSelect(key, files);
}

function getFilesRange(from, to) {
    const files = DOM.getAllFiles();
    const names = DOM.getFilenames(files);
    const getNameIndex = getIndex(names);
    
    const indexFrom = getNameIndex(from);
    const indexTo = getNameIndex(to);
    
    return getRange(indexFrom, indexTo, files);
}

function contextMenu() {
    const fm = DOM.getFM();
    
    Events.addOnce('contextmenu', fm, (event) => {
        CloudCmd.Menu.show({
            x: event.clientX,
            y: event.clientY
        });
    });
    
    Events.addContextMenu(fm, (event) => {
        CloudCmd.Menu.ENABLED || event.preventDefault();
    });
}

function dragndrop() {
    const panels = DOM.getByClassAll('panel');
    const select = () => {
        [...panels].forEach((panel) => {
            panel.classList.add('selected-panel');
        });
    };
    
    const unselect = () => {
        [...panels].forEach((panel) => {
            panel.classList.remove('selected-panel');
        });
    };
    
    const onDrop = (event) => {
        const files = event.dataTransfer.files;
        const items = event.dataTransfer.items;
        const {length: filesCount} = files;
        
        event.preventDefault();
        
        if (filesCount && (!items || !items.length || !items[0].webkitGetAsEntry))
            return uploadFiles(files);
        
        const isFile = (item) => item.kind === 'file';
        const dirFiles = [...items].filter(isFile);
        
        if (dirFiles.length)
            return DOM.uploadDirectory(dirFiles);
        
        return CloudCmd.Operation.show('copy');
    };
    
    /**
     * In Mac OS Chrome dropEffect = 'none'
     * so drop do not firing up when try
     * to upload file from download bar
     */
    const onDragOver = (event) => {
        const dataTransfer = event.dataTransfer;
        const effectAllowed = dataTransfer.effectAllowed;
        
        if (/move|linkMove/.test(effectAllowed))
            dataTransfer.dropEffect = 'move';
        else
            dataTransfer.dropEffect = 'copy';
        
        event.preventDefault();
    };
    
    Events.add('dragenter', select);
    Events.add(['dragleave', 'drop'], unselect);
    
    [...panels].forEach((panel) => {
        Events.add('dragover', panel, onDragOver)
            .add('drop', panel, onDrop);
    });
}

function unload() {
    DOM.Events.add(['unload', 'beforeunload'], (event) => {
        const Key = CloudCmd.Key;
        const isBind = Key && Key.isBind();
        
        if (isBind)
            return;
        
        event.preventDefault();
        return 'Please make sure that you saved all work.';
    });
}

function pop() {
    Events.add('popstate', (event) => {
        const path = event.state.replace(FS, '');
        
        if (!path)
            return CloudCmd.route(location.hash);
        
        const history = false;
        CloudCmd.loadDir({
            path,
            history,
        });
    });
}

function resize() {
    Events.add('resize', () => {
        const is = window.innerWidth < CloudCmd.MIN_ONE_PANEL_WIDTH;
        
        if (!is)
            return;
        
        const {panel} = Info;
        const isEmptyRoot = !panel;
        
        if (isEmptyRoot)
            return;
        
        const name = panel.getAttribute('data-name');
        const isLeft = name === 'js-left';
        
        if (isLeft)
            return;
        
        DOM.changePanel();
    });
}

