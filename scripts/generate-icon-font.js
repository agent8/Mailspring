var gulp = require('gulp');
var iconfont = require('gulp-iconfont');
var iconfontCss = require('gulp-iconfont-css');
var path = require('path');
var absPath = path.resolve('../');
var fontName = `EdisonIcons-${new Date().getTime()}`;
var dealPath = path.join(absPath, './app/static/icons/');

gulp.task('Iconfont', function() {
  return gulp
    .src([path.join(dealPath, '*.svg')])
    .pipe(
      iconfontCss({
        fontName: fontName,
        path: path.join(dealPath, 'template.css'),
        cssClass: 'edison-icon',
        targetPath: '../edison-icon.css',
        fontPath: './fonts/',
      })
    )
    .pipe(
      iconfont({
        fontName: fontName,
        normalize: true,
        formats: ['woff'],
        centerHorizontally: true,
      })
    )
    .pipe(gulp.dest(path.join(absPath, './app/static/fonts')));
});
