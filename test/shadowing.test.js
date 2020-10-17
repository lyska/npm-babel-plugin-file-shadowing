const fs = require("fs");
const { transform } = require("@babel/core");
const moduleResolverPlugin = require("babel-plugin-module-resolver");
const fileShadowingPlugin = require("../");

const getTransformerOpts = (entryFileName) => {
  return {
    babelrc: false,
    plugins: [
      [
        moduleResolverPlugin,
        {
          root: "./test/testproject/src",
          alias: {
            "@base": "./test/testproject/src/base",
            "@level1": "./test/testproject/src/level1",
            "@level2": "./test/testproject/src/level2",
          },
        },
      ],
      [
        fileShadowingPlugin,
        {
          root: "./test/testproject/src",
          layerRoot: "./",
          layers: ["level2", "level1", "base"],
          extensions: [".js", ".jsx", ".ts", ".tsx"],
        },
      ],
    ],
    filename: entryFileName,
  };
};

const indexFileName = "./test/testproject/src/base/index.js";
const indexFileSource = fs.readFileSync(indexFileName, "utf8");

const selfImportFileName = "./test/testproject/src/level1/selfImport.js";
const selfImportFileSource = fs.readFileSync(selfImportFileName, "utf8");

const exportsFileName = "./test/testproject/src/level1/exports.js";
const exportsFileSource = fs.readFileSync(exportsFileName, "utf8");

describe("babel-plugin-file-shadowing", () => {
  it("should resolve imports to highest layer", () => {
    const result = transform(
      indexFileSource,
      getTransformerOpts(indexFileName)
    );

    const expectedOutput = [
      'import baseOnly from "./baseOnly.js";',
      'import level1 from "../level1/level1.js";',
      'import level2 from "../level2/level2.js";',
    ].join("\n");

    expect(result.code).toBe(expectedOutput);
  });

  it("should resolve self imports to lowest layer", () => {
    const result = transform(
      selfImportFileSource,
      getTransformerOpts(selfImportFileName)
    );

    const expectedOutput = [
      'import selfImport from "../base/selfImport.js";',
    ].join("\n");

    expect(result.code).toBe(expectedOutput);
  });

  it("should resolve exports", () => {
    const result = transform(
      exportsFileSource,
      getTransformerOpts(exportsFileName)
    );

    const expectedOutput = [
      'export { level2 } from "../level2/level2.js";',
      'export * from "../base/exports.js";',
    ].join("\n");

    expect(result.code).toBe(expectedOutput);
  });
});
