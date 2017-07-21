/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */
const path = require( 'path' );
const java = require( 'java' );
const loaderUtils = require( 'loader-utils' );
const utils = require( './lib/utils' );

const STRING_WRITER = 'java.io.StringWriter';

module.exports = function( reportData ) {

   const options = loaderUtils.getOptions( this ) || {};
   const classpath = Array.isArray( options.classpath ) ? options.classpath : [ options.classpath ];
   const templateFile = options.template;
   options.templateRootDirectory = path.resolve( this.context, '..' );
   this.addDependency( templateFile );

   this.cacheable();
   this.async();

   if( !java.isJvmCreated() ) {
      java.registerClient( () => {
         classpath.forEach( cp => {
            if( cp ) {
               java.classpath.push( path.resolve( this.context, cp ) );
            }
         } );
      } );
   }

   java.ensureJvm( () => {
      let fmWriter;
      let fmConfig;

      try {
         fmWriter = java.newInstanceSync( STRING_WRITER );
         fmConfig = utils.getFreeMarkerConfig( this, options );
      }
      catch( err ) {
         this.callback( err );
         return;
      }

      pipe( [
         callback => {
            fmConfig.getTemplate( path.relative( options.templateRootDirectory, templateFile ), callback );
         },
         ( template, callback ) => {
            try {
               const fmData = utils.getModel( this.exec( reportData, this.resourcePath ) );
               template.process( fmData, fmWriter, callback );
            }
            catch( err ) {
               callback( err );
            }
         },
         callback => {
            // fmWriter.toString( callback );
            fmWriter.toString( (err, str) => {
               callback( err, str );
               // this is probably where we want to write the processed template to a file for debugging
               // console.log( str );
            } );
         }
      ], this.callback );
   } );
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function pipe( fns, callback ) {
   const stack = fns.slice();

   iterate( null );

   function iterate( err ) {
      const fn = stack.shift();

      if( err || !fn ) {
         callback.apply( null, arguments );
      }
      else {
         fn.apply( null, Array.prototype.slice.call( arguments, 1, fn.length ).concat( [ iterate ] ) );
      }
   }
}

