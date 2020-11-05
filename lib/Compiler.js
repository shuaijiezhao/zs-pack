let path = require('path');
let fs = require('fs');
let babylon = require('babylon');
let t = require('@babel/types');
let ejs = require('ejs');
let traverse = require('@babel/traverse').default;
let generator = require('@babel/generator').default;

/**
 * babylon 主要把源码转换成 ast
 * @babel/traverse
 * @babel/types
 * @babel/generator
 */
class Compiler {
    constructor(config) {
        this.config = config;
        this.entryId; // 需要保存入口文件得路径 './src/index.js'        
        this.modules = {}; // 需要保存所有的模块依赖
        this.entry = config.entry; // 入口路径
        this.root = process.cwd(); // 工作路径
    }

    getSource(modulePath) {
        let content = fs.readFileSync(modulePath, 'utf8');
        return content;
    }

    // 解析源码 AST 解析语法树
    parse(source, parentPath) {
        let ast = babylon.parse(source);
        let dependencies = []; // 依赖的数组

        traverse(ast, {
            CallExpression(p) {
                let node = p.node; // 对应的节点
                if (node.callee.name === 'require') {
                    node.callee.name = '__webpack_require__';
                    let moduleName = node.arguments[0].value; // 取到的是模块的引用名字
                    moduleName = moduleName + (path.extname(moduleName) ? '' : '.js'); 
                    moduleName = './' + path.join(parentPath, moduleName);
                    dependencies.push(moduleName);
                    node.arguments = [t.stringLiteral(moduleName)];
                }
            }
        });

        let sourceCode = generator(ast).code;
        return { sourceCode, dependencies };
    }

    // 构建模块
    buildModule(modulePath, isEntry) {
        let source = this.getSource(modulePath);
        let moduleName = './' + path.relative(this.root, modulePath); // 相对路径

        isEntry ? this.entryId = moduleName : null; // 保存入口的名字

        // path.dirname(moduleName) 相对路径的父路径
        let { sourceCode, dependencies } = this.parse(source, path.dirname(moduleName));
        // 把相对路径和模块中的内容对应起来
        this.modules[moduleName] = sourceCode;

        // 附模块的加载
        dependencies.forEach(dep => {
            this.buildModule(path.join(this.root, dep), false);
        });
    }

    emitFile() {
        const { path, filename } = this.config.output;
        let main = path.join(path, filename); // 输出路径
        let templateStr = this.getSource(path.join(__dirname, 'main.ejs')); // 模板的路径
        let code = ejs.render(templateStr, { 
            entryId: this.entryId,
            modules: this.modules
        })

        this.assets = {};
        this.assets[main] = code; // 资源中路径对应的代码
        fs.writeFileSync(main, code);
    }

    run() {
        // 执行并且创建模块的依赖关系
        this.buildModule(path.resolve(this.root, this.entry), true);

        this.emitFile(); // 发射打包后的文件
    }
}

module.exports = Compiler;