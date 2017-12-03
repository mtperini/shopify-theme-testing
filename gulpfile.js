// Environment
var dotenv             = require('dotenv').config();

// General Gulp Packages
var gulp               = require('gulp');
var watch              = require('gulp-watch');
var notify             = require('gulp-notify');
var rename             = require('gulp-rename');
var changed            = require('gulp-changed');
var plumber            = require('gulp-plumber');
var sourcemaps         = require('gulp-sourcemaps');
var shopify            = require('gulp-shopify-upload-with-callbacks');

// Sass Gulp Packages
var sass               = require('gulp-sass');
var autoprefixer       = require('gulp-autoprefixer');

// JS Gulp Packages
var uglify             = require('gulp-uglify');
var concat             = require('gulp-concat');

// Non-Gulp Packages
var del                = require('del');
var path               = require('path');
var runsequence        = require('run-sequence');

// Error handler to prevent gulp from exiting on error
var plumberErrorHandler = {
  errorHandler: notify.onError({
    title: '<%= error.plugin %>',
    message: 'Error: <%= error.message %>'
  })
};

// Remove file from deploy/ when removed from associated dev/ directory
var checkForDelete = function (event) {
  if (event.type === 'deleted') {
    var filePathFromSrc = path.relative(path.resolve('dev/liquid'), event.path);
    var destFilePath = path.resolve('deploy', filePathFromSrc);
    del.sync(destFilePath);
  }
};

// Compile sass, run autoprefixer on output, inline sourcemap, add .liquid extension
gulp.task('styles', function () {
  return gulp.src(['dev/styles/*.scss'])
    .pipe(plumber(plumberErrorHandler))
    .pipe(sourcemaps.init())
    .pipe(sass({outputStyle: 'compressed'}))
    .pipe(autoprefixer())
    .pipe(sourcemaps.write())
    .pipe(rename({ suffix: '.css', extname: '.liquid' }))
    .pipe(gulp.dest('deploy/assets'));
});

// Concatenate files into single theme-scripts.js file, minifiy theme-scripts.js, inline sourcemap, add .liquid extension
gulp.task('scripts', function () {
  return gulp.src(['dev/scripts/*.js'])
    .pipe(plumber(plumberErrorHandler))
    .pipe(sourcemaps.init())
    .pipe(concat('theme-scripts.js'))
    .pipe(uglify())
    .pipe(sourcemaps.write())
    .pipe(rename({ suffix: '.js', extname: '.liquid' }))
    .pipe(gulp.dest('deploy/assets'));
});

// Copy images from dev/images/ to deploy/assets
gulp.task('imagecopy', function () {
  return gulp.src(['dev/images/*'])
    .pipe(plumber(plumberErrorHandler))
    .pipe(changed('deploy/assets', {hasChanged: changed.compareSha1Digest}))
    .pipe(gulp.dest('deploy/assets'));
});

// Copy files from dev/liquid to deploy/ while maintaining directory structure
gulp.task('copy', function () {
  return gulp.src(['dev/liquid/**/*'], {base: 'dev/liquid'})
    .pipe(plumber(plumberErrorHandler))
    .pipe(changed('deploy/'))
    .pipe(gulp.dest('deploy/'));
});

// Clear out deploy/ to ensure fresh build
gulp.task('clean', function () {
  del(['deploy/**/*'], {force: true});
});

// Clear out deploy, run copy, imagecopy, styles, and scripts tasks
gulp.task('build', ['clean'], function (cb) {
  runsequence(['copy', 'imagecopy', 'styles', 'scripts'], cb);
});

// Watch dev/ directories and run associated task on file change
gulp.task('watch', ['build'], function () {
  gulp.watch(['dev/styles/**/*.scss'], ['styles']);
  gulp.watch(['dev/scripts/**/*.js'], ['scripts']);
  gulp.watch(['dev/images/*'], ['imagecopy']).on('change', checkForDelete);
  gulp.watch(['dev/liquid/**/*'], ['copy']).on('change', checkForDelete);
});

// Upload changed file to Shopify theme specified in .env
gulp.task('upload', ['watch'], function (cb) {
  if (!process.env.THEME_ID) {
    return false;
  } else {
    return watch('deploy/{assets|layout|config|snippets|templates|locales|sections}/**')
      .pipe(shopify(process.env.API_KEY, process.env.PASSWORD, process.env.URL, process.env.THEME_ID, {basePath: 'deploy/'}));
  }
});

// Set default `gulp` task to run the build and start watching files
gulp.task('default', ['clean', 'build', 'watch', 'upload']);
