var express = require('express'),
    bodyParser = require('body-parser'),
    bl = require('bl'),
    archiver = require('archiver'),
    Flickr = require("flickrapi"),
    flickrOptions = {
      api_key: process.env.API_KEY,
      secret: process.env.SECRET,
      user_id: process.env.USER_ID,
      access_token: process.env.ACCESS_TOKEN,
      access_token_secret: process.env.ACCESS_TOKEN_SECRET
    };
    nodemailer = require('nodemailer'),
      transporter = nodemailer.createTransport({
          service: process.env.MAIL_SERVICE,
          auth: {
              user: process.env.MAIL_USER,
              pass: process.env.MAIL_PASSWORD
          }
      }, {
          // default message fields
          // sender info
          from: process.env.MAIL_FROM
      });


var app = express();

app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static(__dirname + '/public'));

app.post('/generateSession', function (req, res) {
  console.log('body:'+JSON.stringify(req.body, null, 4));
  res.send('Petición recibida. Recibiras un e-mail cuando esté preparado.');

  getPhotoset(req.body.flickrgalleryid, function (err, photoset) {
   if (err) {
     console.log('Error getting photoset: '+err);
   } else {

     var photosetStr = JSON.stringify(photoset, null, 4);
     console.log('photoset:'+photosetStr);
     var photosetFile = {
       route: '_data/photosets/',
       name:  photoset.id+'.json',
       content: photosetStr
     }
      generatePostFile(req.body, function (err, post, fileName) {
        if (err) {
          console.log('Error generating the post file: '+err);
        } else {
          var postFile = {
            route: '_posts/',
            name:  fileName+'.md',
            content: post
          }
          generateZip([photosetFile, postFile], function (err, zip) {
            if (!err) {
              sendMail(zip, fileName);
            }
          })
        }
      })
   }
  })
});

function sendMail(compressedFile, title) {
  let message = {
      to: process.env.MAIL_TO,
      subject: 'Sesión '+title+' generada',
      text: 'Este mensaje se ha generado automaticamente gracias a SessionGenerator. Puedes descargar el comprimido adjunto.',
      attachments: [
          {
              filename: title+'.zip',
              content: compressedFile,
              cid: process.env.MAIL_USER
          }
      ]
  };
  transporter.sendMail(message, (error, info) => {
      if (error) {
          console.log('Error occurred');
          console.log(error.message);
          return;
      }
      console.log('Message sent successfully!');
      console.log('Server responded with "%s"', info.response);
      transporter.close();
  });

}


function generateZip(files, callback) {
  var archive = archiver('zip');

  archive.on('warning', function(err) {
    if (err.code === 'ENOENT') {
        console.log('archive warning ENOENT');
    } else {
        throw err;
    }
  });

  archive.on('error', function(err) {
    throw err;
  });


  for (var i = 0; i < files.length; i++) {
    archive.append(Buffer.from(files[i].content),
                  { name: files[i].route + files[i].name } );
  }

  let resultBuffer;
  archive.pipe(
    bl((err, data) => {
      resultBuffer = data;
    })
  );

  archive.finalize().then(x => {
    console.log('Zip finalized');
    callback(false, resultBuffer)
  });
}


function generatePostFile(info, callback) {
  var categoriesStr = '';
  if (info.categories) {
    if (info.categories instanceof Array) {
      categoriesStr  = "["+info.categories.join(", ")+"]";
    } else {
      categoriesStr = info.categories;
    }
  }

  var fileContent =
`---
# Archivo autogenerado

# No tocar
layout: gallery

# Categoria
categories: ${categoriesStr}

# Título en la página /sesiones
title: "${info.title}"

# Enlace personalizado ej: ariadnaballestar.com/sesiones/NOMBRESESION
permalink: /${info.permalink}

# Texto que se insertara en la etiqueta alt de todas las imagenes de la sesión
altimages: "${info.altimages}"

# Colaboradores
colaboradores:
`;
  if (info.colaboradores) {
    for (var i = 0; i < info.colaboradores.length; i++) {
      fileContent += ` - title: "${info.colaboradores[i].title}"\n`;
      fileContent += `   name: "${info.colaboradores[i].name}"\n`;
      if (info.colaboradores[i].link) {
        fileContent += `   link: "${info.colaboradores[i].link}"\n`;
      }
    }
  }

  fileContent +=
`
# Imagenes de flickr
flickralbum: ${info.flickrgalleryid}

---
${info.content}
`;
  var fileName = info.fecha+'-'+info.permalink;
  callback(false, fileContent, fileName);
}

function getPhotoset(galleryid, callback) {
  Flickr.authenticate(flickrOptions, function(error, flickr) {
      console.log('Authenticated');
      if (error) console.error(error);
	  	flickr.photosets.getPhotos({
		  photoset_id: galleryid,
		  user_id: flickrOptions.user_id,
		  page: 1,
		  per_page: 200,
		  extras: 'url_m',
      //extras: 'license, date_upload, date_taken, owner_name, icon_server, original_format, last_update, geo, tags, machine_tags, o_dims, views, media, path_alias, url_sq, url_t, url_s, url_m, url_o',
      extras: 'tags',
      authenticated: true
		}, function(err, result) {
      console.log('Obtained photos? '+ result);
      if (err) {
        console.log('Error obtaining photos: '+err)
      }
			if (result) {

        var photosetInfo = {
          id: result.photoset.id,
          title: result.photoset.title,
          primaryPhoto: result.photoset.primary,
          photos: []
        }

        var iteratePhotos = function(i){
          if( i < result.photoset.photo.length ) {
            var p = result.photoset.photo[i];

            console.log('Inside photo number ' + i);


            var photo = {
              id: p.id,
              title: p.title,
              tags: p.tags,
              sizes: []
            }
            console.log('Photo ID: '+ p.id);
            flickr.photos.getSizes(
              { photo_id: photo.id,
                user_id: flickrOptions.user_id,
                authenticated: true  },
              function (err, sizeResult) {
                if (err) {
                  console.log('Error at getSizes:'+err);
                }
                if (sizeResult) {
                    console.log('getSizes succeed, working...');
                    var sizes = [];
                    for (var j = 0; j < sizeResult.sizes.size.length; j++) {
                      var sz = sizeResult.sizes.size[j];
                      var size = {
                        label: sz.label,
                        height: sz.height,
                        width: sz.width,
                        url: sz.source
                      }
                      photo.sizes.push(size);
                    }
                    photosetInfo.photos.push(photo);

                    if (i === result.photoset.photo.length -1) { // last photo
                      callback(false, photosetInfo);
                    } else {
                      iteratePhotos(i+1);
                    }
                }
              }
            );
          }
        };

        iteratePhotos(0);

			}

		});
	});
}

var port = normalizePort(process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || '3000');
var ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0'

app.listen(port, ip);
console.log('Server running on http://%s:%s', ip, port);

/*
app.listen(port, function () {
  console.log('Session Generator listening on port '+port);
});
*/
function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}
