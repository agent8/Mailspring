var gulp = require('gulp');
var iconfont = require('gulp-iconfont');
var iconfontCss = require('gulp-iconfont-css');
var path = require('path');
var absPath = path.resolve('../');
var fontName = `EdisonIcons`;
var dealPath = path.join(absPath, './app/static/icons/');
var cacheBusterQueryString = new Date().getTime();
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
        cacheBuster: cacheBusterQueryString,
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
