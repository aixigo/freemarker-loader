/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */

'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const expect = require( 'chai' ).expect;
const loader = require( '..' );

describe( 'freemarker-loader', () => {

   it( 'runs', done => {
      runLoader( {
         query: '?template=' + __dirname + '/index.html&classpath=freemarker.jar',
         callback( err, source ) {
            if( err ) {
               done( err );
               return;
            }

            expect( dropEmptyLines( source ) ).to.equal( [
               '<h1>Date: Nov 12, 1955 10:04:00 PM</h1>',
               '<dl>',
               '   <dt><em>twelve</em>:</dt><dd>12</dd>',
               '   <dt><em>fourty three</em>:</dt><dd>43</dd>',
               '   <dt><em>one hundred and three</em>:</dt><dd>123</dd>',
               '</dl>'
            ].join( '\n' ) );
            done();
         }
      }, __dirname + '/data.js' );
   } );

   function dropEmptyLines( string ) {
      return string
         .split( '\n' )
         .filter( line => !(/^\s*$/.test( line )) )
         .join( '\n' );
   }

   function runLoader( options, request ) {
      const resourcePath = request.split( '!' ).pop();
      const source = fs.readFileSync( resourcePath );

      loader.call( Object.assign( {
         options: { context: __dirname },
         context: __dirname,
         resourcePath,
         fs,
         cacheable() {},
         async() {},
         addDependency() {},
         loadModule( request, callback ) {
            const filename = path.resolve( this.context, request );
            fs.readFile( filename, callback );
         },
         exec( source ) {
            // eslint-disable-next-line no-new-func
            const fn = new Function( 'module', 'exports', source );
            const module = {
               exports: {}
            };
            fn( module, module.exports );
            return module.exports;
         }
      }, options ), source, {} );
   }

});
