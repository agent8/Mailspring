/* eslint global-require: 0 */ /* eslint prefer-template: 0 */
/* eslint quote-props: 0 */
module.exports = grunt => {
  grunt.config.merge({
    'string-replace': {
      dist: {
        files: {
          'internal_packages/': [
            'internal_packages/**/*.js',
            'internal_packages/**/*.jsx',
            'internal_packages/**/*.es',
            'internal_packages/**/*.es6',
          ],
          'src/': ['src/**/*.js', 'src/**/*.jsx', 'src/**/*.es', 'src/**/*.es6'],
        },
        options: {
          replacements: [
            {
              pattern: 'ENV_S3_REGION',
              replacement: process.env.S3_REGION,
            },
            {
              pattern: 'ENV_S3_ACCESSKEY_ID',
              replacement: process.env.S3_ACCESSKEY_ID,
            },
            {
              pattern: 'ENV_S3_SECRET_ACCESSKEY',
              replacement: process.env.S3_SECRET_ACCESSKEY,
            },
          ],
        },
      },
    },
  });

  grunt.loadNpmTasks('grunt-string-replace');
  grunt.registerTask('env-replace', ['string-replace']);
};
