# babel-plugin-file-shadowing

Babel plugin that allows using file shadowing to override module imports based on file path conventions.
The plugin allows configuring multiple folders as "layers". If a higher layer has a module under the same path as a lower layer, then imports for that module will be rewritten to use the module in the higher layer.

For example:

```
import value from './src/base/test.js'
```

in a folder structure like this where `['custom','base']` are the configured layers (`custom` is higher / before `base`):

```
src
  base
    test.js
  custom
    test.js
```

will rewrite the import to:

```
import value from `./src/custom/test.js`
```

## Configuration

**Example**

`.babelrc`

```
{
  ...
  plugins: [
    [
      '@lyska/babel-plugin-file-shadowing',
      {
        root: "./",
        layerRoot: "./src",
        layers: ["level2", "level1", "base"],
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      },
    ],
  ]
  ...
}
```

- **root** Project root directory
- **layerRoot** Relative path from `root` to the folder containing all layers
- **layers** Names of the layers which exist in `layerRoot`, in the order from highest to the lowest layer
- **extensions** File extensions to consider when trying to resolve modules in layers
