'use strict';

const DIR = __dirname + '/../../';
const COMMONDIR = DIR + 'common/';
const TMPLDIR = DIR + 'tmpl/';

const Util = require(COMMONDIR + 'util');
const CloudFuncPath = COMMONDIR + 'cloudfunc';

const CloudFunc = require(CloudFuncPath);

const files = require('files-io');
const currify = require('currify');

const swap = currify((fn, a, b) => fn(b, a));

const test = require('tape');
const fresh = swap(require('fresh-require'), require);

const htmlLooksLike = require('html-looks-like');

const FS_DIR = TMPLDIR   + 'fs/';
const EXPECT_PATH = __dirname + '/cloudfunc.html';

const TMPL_PATH = [
    'file',
    'path',
    'pathLink',
    'link',
];

const JSON_FILES = {
    path  : '/etc/X11/',
    files : [{
        name: 'applnk',
        size: 'dir',
        date: '21.02.2016',
        uid : 0,
        mode: 'rwx r-x r-x'
    }, {
        name: 'prefdm',
        size: '1.30kb',
        date: 0,
        uid : 0,
        mode: 'rwx r-x r-x'
    }]
};

let Expect =
    '<div data-name="js-path" class="reduce-text" title="/etc/X11/">'       +
        '<span data-name="js-clear-storage" class="path-icon icon-clear" '  +
            'title="clear storage (Ctrl+D)">'                               +
        '</span>'                                                           +
        '<a data-name="js-refresh" href="/fs/etc/X11/" '                    +
        'class="path-icon icon-refresh" title="refresh (Ctrl+R)"></a>'      +
        '<span data-name="js-links" class=links>'                           +
            '<a data-name="js-path-link" href="/fs/" title="/">/</a>'       +
            '<a data-name="js-path-link" href="/fs/etc/" title="/etc/">'    +
                'etc'                                                       +
            '</a>/X11/'                                                     +
        '</span>'                                                           +
    '</div>';

test('cloudfunc: render', (t) => {
    const paths = {};
    const filesList = TMPL_PATH
        .map((name) => {
            const path = FS_DIR + name + '.hbs';
            
            paths[path] = name;
            
            return path;
        })
        .concat(EXPECT_PATH);
    
    files.read(filesList, 'utf8', (error, files) => {
        const template = {};
        
        if (error)
            throw(Error(error));
            
        Util.time('CloudFunc.buildFromJSON');
        
        Object.keys(files).forEach((path) => {
            const name = paths[path];
            
            if (path !== EXPECT_PATH)
                template[name] = files[path];
        });
        
        const expect = files[EXPECT_PATH];
        const result = CloudFunc.buildFromJSON({
            prefix  : '',
            data    : JSON_FILES,
            template: template
        });
        
        Expect += expect;
        
        let i;
        const isNotOk = Expect
            .split('')
            .some((item, number) => {
                const ret = result[number] !== item;
                
                if (ret) {
                    i = number;
                }
                
                return ret;
            });
        
        Util.timeEnd('CloudFunc.buildFromJSON');
        
        if (isNotOk) {
            console.log(
                `Error in char number: ${i}\n`,
                `Expect: ${Expect.substr(i)}\n`,
                `Result: ${result.substr(i)}`
            );
            
            console.log('buildFromJSON: Not OK');
        }
        
        t.equal(Expect, result, 'should be equal rendered json data');
        
        htmlLooksLike(Expect, result);
        
        t.end();
    });
});

test('cloudfunc: formatMsg', (t) => {
    const msg = 'hello';
    const name = 'name';
    const status = 'ok';
    
    const result = CloudFunc.formatMsg(msg, name, status);
    
    t.equal(result, 'hello: ok("name")');
    t.end();
});

test('cloudfunc: formatMsg', (t) => {
    const msg = 'hello';
    const name = null;
    const status = 'ok';
    
    const result = CloudFunc.formatMsg(msg, name, status);
    
    t.equal(result, 'hello: ok');
    t.end();
});

test('cloudfunc: getTitle', (t) => {
    const CloudFunc = fresh(CloudFuncPath);
    
    const result = CloudFunc.getTitle();
    
    t.equal(result, 'Cloud Commander - /');
    t.end();
});

test('cloudfunc: getTitle: no name', (t) => {
    const CloudFunc = fresh(CloudFuncPath);
    const path = '/hello/world';
    
    const result = CloudFunc.getTitle({
        path
    });
    
    t.equal(result, 'Cloud Commander - /hello/world');
    t.end();
});

test('cloudfunc: getTitle: name, path', (t) => {
    const CloudFunc = fresh(CloudFuncPath);
    const name = 'hello';
    const path = '/hello/world';
    
    const result = CloudFunc.getTitle({
        name,
        path,
    });
    
    t.equal(result, 'hello - /hello/world');
    t.end();
});

test('cloudfunc: getHeaderField', (t) => {
    const sort = 'name';
    const order = 'desc';
    const name = 'name';
    
    const result = CloudFunc.getHeaderField(sort, order, name);
    const expected = 'name↓';
    
    t.equal(result, expected, 'should set desc arrow');
    t.end();
});

test('cloudfunc: getPathLink: no url', (t) => {
    t.throws(CloudFunc.getPathLink, 'should throw when no url');
    t.end();
});

test('cloudfunc: getPathLink: no template', (t) => {
    const url = 'http://abc.com';
    const prefix = '';
    const fn = () => CloudFunc.getPathLink(url, prefix);
    
    t.throws(fn, 'should throw when no template');
    t.end();
});

test('cloudfunc: getDotDot', (t) => {
    const dotDot = CloudFunc.getDotDot('/home');
    
    t.equal(dotDot, '/', 'should return root');
    t.end();
});

test('cloudfunc: getDotDot: two levels deep', (t) => {
    const dotDot = CloudFunc.getDotDot('/home/coderaiser/');
    console.log(dotDot);
    
    t.equal(dotDot, '/home', 'should return up level');
    t.end();
});

