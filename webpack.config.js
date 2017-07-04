const UglifyJSPlugin = require('uglify-es-webpack-plugin')
const path = require('path')
const nodeExternals = require('webpack-node-externals')

module.exports = {
  target: 'node',
  externals: [nodeExternals()],
  entry: {
    app: './index.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    libraryTarget: 'commonjs2'
  },
  plugins: [
    new UglifyJSPlugin({
      compress: {
        warnings: false
      }
    })
  ]
}
