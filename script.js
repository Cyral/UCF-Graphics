//  browserify script.js -o bundle.js

const mat4 = require('gl-mat4')
const bunny = require('bunny')
const normals = require('angle-normals')

const canvas = document.querySelector("#canvas");
// Get the system DPI and scale the canvas accordingly so that it looks nice
// on high DPI displays.
const desiredWidth = 1000;
const desiredHeight = 600;
const dpi = window.devicePixelRatio || 1;
canvas.width = desiredWidth * dpi;
canvas.height = desiredHeight * dpi;
canvas.style.width = desiredWidth + "px";
canvas.style.height = desiredHeight + "px";

const regl = require('regl')({canvas: canvas, extensions: ['angle_instanced_arrays', 'OES_texture_float']})
const camera = require('canvas-orbit-camera')(canvas)
const framebuffer = regl.framebuffer({
  color: regl.texture({
    width: 1,
    height: 1,
    wrap: 'clamp'
  }),
  depth: true
});
const mapframebuffer = regl.framebuffer({
  color: regl.texture({
    width: 1,
    height: 1,
    wrap: 'clamp'
  }),
  depth: true
});

// configure initial camera view.
camera.rotate([0.0, 0.0], [0.0, 0.0]);
camera.zoom(2000.0);
camera.pan([0,.002]);
const drawBunnies = regl({
  frag: `
  precision mediump float;
  varying vec3 vNormal;
  varying vec3 vColor;
  varying vec3 vPosition;
  varying vec3 vGlPosition;
  uniform sampler2D tex;
  void main () {
    vec3 color = texture2D(tex, vPosition.xy).rgb;
    vec3 ambient = vec3(0.3) * color;
    vec3 lightDir = vec3(0.39, 0.87, 0.29);
    vec3 diffuse = vec3(0.7) * color * clamp(dot(vNormal, lightDir) , 0.0, 1.0 );
    gl_FragColor = vec4(ambient + diffuse, 1.0);
  }`,
  vert: `
  precision mediump float;
  attribute vec3 position;
  attribute vec3 normal;

  uniform mat4 proj;
  uniform mat4 model;
  uniform mat4 view;
  varying vec3 vNormal;
  varying vec3 vColor;
  varying vec3 vPosition;
  varying vec3 vGlPosition;
  void main () {
    vNormal = normal;
    vColor = vec3(1.0,1.0,1.0);
    vPosition = position;
    gl_Position = proj * view * model * vec4(position, 1.0);
    vGlPosition = gl_Position.xyz;
  }`,
  attributes: {
    position: bunny.positions,
    normal: normals(bunny.cells, bunny.positions),
  },
  elements: bunny.cells,
  uniforms: {
    tex: regl.prop('texture'),
    proj: ({viewportWidth, viewportHeight}) =>
      mat4.perspective([],
        Math.PI / 2,
        viewportWidth / viewportHeight,
        0.01,
        1000),
    model: mat4.identity([]),
    view: () => camera.view()
  }
});

const drawBunniesMap = regl({
  frag: `
  precision mediump float;
  varying vec3 vGlPosition;
  uniform vec3 focal;
  #define range float(5)
  void main () {
    float z = 1.0 - (abs(distance(focal, vGlPosition)) / range);
    gl_FragColor = vec4(vec3(1.0,1.0,1.0) * z, 1.0);
  }`,
  vert: `
  precision mediump float;
  attribute vec3 position;
  attribute vec3 normal;

  uniform vec3 focal;
  
  uniform mat4 proj;
  uniform mat4 model;
  uniform mat4 view;
  
  varying vec3 vGlPosition;
  void main () {
    gl_Position = proj * view * model * vec4(position, 1.0);
    vGlPosition = gl_Position.xyz;
  }`,
  attributes: {
    position: bunny.positions,
    normal: normals(bunny.cells, bunny.positions),
  },
  elements: bunny.cells,
  uniforms: {
    focal: [0,0,7],
    proj: ({viewportWidth, viewportHeight}) =>
      mat4.perspective([],
        Math.PI / 2,
        viewportWidth / viewportHeight,
        0.01,
        1000),
    model: mat4.identity([]),
    view: () => camera.view()
  }
});

const drawBuffer = regl({
  frag: ` 
  precision mediump float;
  uniform sampler2D tex;
  varying vec2 fragPosition;

  void main() {
    gl_FragColor = texture2D(tex, fragPosition);
  }`,
  vert: `
  precision mediump float;
  attribute vec2 position;
  varying vec2 fragPosition;

  void main() {
    fragPosition = 0.5 * (position + 1.0);
    gl_Position = vec4(position, 0, 1);
  }`,
  attributes: {
    position: [ -4, -4, 4, -4, 0, 4 ]
  },
  uniforms: {
    tex: mapframebuffer,
  },
  depth: { enable: false },
  count: 3,
});

const drawBufferBlurred = regl({
  frag: ` 
  precision mediump float;
  uniform sampler2D tex;
  uniform sampler2D maptex;
  varying vec2 fragPosition;
  uniform float wRcp, hRcp;

  void main() {
    const float Pi = 6.28318530718; // Pi*2
    
    // GAUSSIAN BLUR SETTINGS {{{
    const float Directions = 16.0; // BLUR DIRECTIONS (Default 16.0 - More is better but slower)
    const float Quality = 4.0; // BLUR QUALITY (Default 4.0 - More is better but slower)
    const float Size = 16.0; // BLUR SIZE (Radius)
    
    
    vec4 avg = texture2D(tex, fragPosition);
    
    for( float d=0.0; d<Pi; d+=Pi/Directions)
    {
        for(float i=1.0/Quality; i<=1.0; i+=1.0/Quality)
        {
          avg += texture2D(tex, fragPosition+vec2(cos(d) * wRcp,sin(d) * hRcp)*Size*i);
        }
    }
    avg /= Quality * Directions;

    
    vec4 actual = texture2D(tex, fragPosition);
    vec4 amount = texture2D(maptex, fragPosition);
    vec4 color = mix(actual, avg, 1.0 - amount.r);
    gl_FragColor = vec4(color) * color.a;
  }`,
  vert: `
  precision mediump float;
  attribute vec2 position;
  varying vec2 fragPosition;

  void main() {
    fragPosition = 0.5 * (position + 1.0);
    gl_Position = vec4(position, 0, 1);
  }`,
  attributes: {
    position: [ -4, -4, 4, -4, 0, 4 ]
  },
  uniforms: {
    tex: framebuffer,
    maptex: mapframebuffer,
    wRcp: ({viewportWidth}) => 1.0 / viewportWidth,
    hRcp: ({viewportHeight}) => 1.0 / viewportHeight
  },
  depth: { enable: false },
  count: 3,
});

const setupDefault = regl({
  framebuffer: framebuffer,
});

const setupMap = regl({
  framebuffer: mapframebuffer,
});

require('resl')({
  manifest: {
    texture: {
      type: 'image',
      src: 'texture.jpg',
      parser: (data) => regl.texture({
        data: data,
        mag: 'linear',
        min: 'linear',
        wrap: 'repeat'
      })
    }
  },
  onDone: ({texture}) => {
    regl.frame(({deltaTime, viewportWidth, viewportHeight}) => {
      framebuffer.resize(viewportWidth, viewportHeight);
      mapframebuffer.resize(viewportWidth, viewportHeight)

      setupDefault({}, () => {
        regl.clear({
          color: [0,0,0, 1],
          depth: 1,
        });
        drawBunnies({
          texture: texture
        });
      });

      setupMap({}, () => {
        regl.clear({
          color: [0, 0, 0, 1],
          depth: 1,
        });

        drawBunniesMap();
      });

      regl.clear({
        color: [1, 0, 0, 1],
        depth: 1,
      });
      drawBuffer();
      drawBufferBlurred();

      camera.tick();
    })
  }
})

