/**
 * Base webpack config used across other specific configs
 */

import path from 'path';
import webpack from 'webpack';
import { dependencies } from '../package.json';

const postcssPlugins = [
  require('postcss-cssnext')(),
  require('postcss-modules-values')
];

const scssLoader = [
  { loader: 'style-loader' },
  { loader: 'css-loader' },
  { loader: 'sass-loader' }
];

const postcssLoader = [
  { loader: 'style-loader' },
  { loader: 'css-loader', options: { modules: true } },
  { loader: 'postcss-loader', options: { plugins: () => [...postcssPlugins] } }
];

export default {
  externals: [...Object.keys(dependencies || {})],

  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true
          }
        }
      }
    ],
    loaders: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        loader: 'babel-loader',

        query: {
          presets: ['es2015', 'react']
        }
      },
      {
        test: /\.(scss|sass)$/,
        loader: scssLoader,
        include: [__dirname]
      },
      {
        test: /\.css$/,
        loader: postcssLoader,
        include: [__dirname]
      }
    ]
  },

  output: {
    path: path.join(__dirname, '..', 'app'),
    // https://github.com/webpack/webpack/issues/1114
    libraryTarget: 'commonjs2'
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['.js', '.jsx', '.json']
  },

  plugins: [
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production'
    }),

    new webpack.NamedModulesPlugin()
  ]
};
