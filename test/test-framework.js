const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { describe, it } = require('mocha');
const yaml = require('js-yaml');

const workspaceRoot = path.resolve(__dirname, "../");

exports.runTests = function (config) {
    const testcaseDirectory = config.isDebugMode ? path.resolve(config.casesDirectory, 'debug') : config.casesDirectory;
    const fullTestcaseDirectory = path.resolve(workspaceRoot, testcaseDirectory);

    // 获取所有子文件夹
    const testFiles = findTestFiles(fullTestcaseDirectory);

    describe('Data Driven Tests', function () {
        testFiles.forEach(file => {
            const filePath = path.resolve(workspaceRoot, testcaseDirectory, file);
            const testCase = yaml.load(fs.readFileSync(filePath, 'utf8'));

            it(testCase.desc, async function () {
                this.timeout(10000);
                const result = await config.testFunction(testCase.given, filePath);

                // 如果提供了自定义验证函数，则使用它进行验证
                if (config.customValidator) {
                    config.customValidator(result, testCase);
                } else {
                    // 否则使用默认验证逻辑
                    validateResult(result, testCase);
                }
            });
        });
    });
};

function findTestFiles(directory) {
    const testFiles = [];

    function traverseDirectory(dir) {
        const files = fs.readdirSync(dir, { withFileTypes: true });

        for (const file of files) {
            const fullPath = path.join(dir, file.name);
            if (file.isDirectory()) {
                traverseDirectory(fullPath);
            } else if (file.name === 'test.yaml') {
                testFiles.push(fullPath);
            }
        }
    }

    traverseDirectory(directory);
    return testFiles;
}

function validateResult(result, testCase) {
    const { then } = testCase;
    Object.keys(then).forEach(key => {
        if (key === 'ruleMatch') {
            handleRuleMatch(result, then[key]);
        } else {
            // 对于除ruleMatch外的其他键进行默认相等验证
            expect(result[key]).to.deep.equal(then[key]);
        }
    });
}

function handleRuleMatch(result, rules) {
    // 处理ruleMatch规则
    rules.forEach(rule => {
        const actualValue = rule.target && rule.target !== '' ? result[rule.target] : result;
        
        // 根据rule.type处理不同的验证逻辑
        switch (rule.type) {
            case "lengthNotGreaterThan":
                expect(actualValue.length, `Expected length to be at most ${rule.value}, but got ${actualValue.length}`).to.be.at.most(rule.value);
                break;
            case "lengthGreaterThan":
                expect(actualValue.length, `Expected length to be greater than ${rule.value}, but got ${actualValue.length}`).to.be.greaterThan(rule.value);
                break;
            case "stringEqualsIgnoreCase":
                const expectedValue = rule.value;
                expect(actualValue.toLowerCase(), `Expected to equal '${expectedValue}' ignoring case, but got '${actualValue}'`).to.equal(expectedValue.toLowerCase());
                break;
            // 添加更多规则类型的处理逻辑
            default:
                throw new Error(`Unhandled rule type: ${rule.type}`);
        }
    });
}
