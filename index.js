/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */

'use strict';

const path = require( 'path' );
const java = require( 'java' );
const loaderUtils = require( 'loader-utils' );
const utils = require( './lib/utils' );

const STRING_WRITER = 'java.io.StringWriter';

module.exports = function( source ) {

   const options = loaderUtils.getOptions( this ) || {};
   const classpath = Array.isArray( options.classpath ) ? options.classpath : [ options.classpath ];
   const baseDirectory = options.context
     ? options.context
     : ( this.options.context || process.cwd());
   const template = loaderUtils.interpolateName( this, options.template, { content: source } );

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
      let fmConfig;

      try {
         fmConfig = utils.getFreeMarkerConfig( this, options, baseDirectory );
      }
      catch( err ) {
         this.callback( err );
         return;
      }

      fmConfig.getTemplate( path.relative( baseDirectory, template ), ( err, template ) => {
         invokeBlocking( callback => {
            try {
               const untransformedModel = this.exec( source, this.resourcePath );
               const fmData = utils.getModel( untransformedModel );
               const fmWriter = java.newInstanceSync( STRING_WRITER );
               template.process( fmData, fmWriter, () => {
                  callback( null, fmWriter.toStringSync() );
               } );
            }
            catch( err ) {
               callback( err );
            }
         }, this.callback );
      } );
   } );
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

let nextPromise = Promise.resolve();
function invokeBlocking( job, callback ) {
   const previousNext = nextPromise;
   nextPromise = new Promise( resolve => {
      previousNext.then( () => {
         job( ( ...args ) => {
            callback( ...args );
            resolve();
         } );
      } );
   } );
}
