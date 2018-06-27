const UglifyJSPlugin = require('uglifyjs-webpack-plugin')
const path = require('path')
const nodeExternals = require('webpack-node-externals')
const webpack = require('webpack')

module.exports = {
  target: 'node',
  externals: [nodeExternals()],
  entry: {
    app: './src/main.js'
  },
  output: {
    path: path.resolve(__dirname, '../dist'),
    filename: '[name].bundle.js',
    libraryTarget: 'commonjs2'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['env', {
                'targets': {
                  'node': 'current'
                }
              }]
            ]
          }
        }
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.HANDYNOTE_SERVICE_PORT': JSON.stringify(process.env.HANDYNOTE_SERVICE_PORT),
      'process.env.HANDYNOTE_MONGO_URL': JSON.stringify(process.env.HANDYNOTE_MONGO_URL),
      'process.env.HANDYNOTE_STATIC_ROOT': JSON.stringify(process.env.HANDYNOTE_STATIC_ROOT),
      'process.env.HANDYNOTE_CERT_PATH': JSON.stringify(process.env.HANDYNOTE_CERT_PATH)
    }),
    new UglifyJSPlugin()
  ]
}
