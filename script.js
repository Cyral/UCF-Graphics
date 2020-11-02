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
camera.rotate([0.0, 0.0], [0.0, -0.4])
camera.zoom(70.0)

var N = 15 // N bunnies on the width, N bunnies on the height.

var angle = []
for (var i = 0; i < N * N; i++) {
  // generate random initial angle.
  angle[i] = Math.random() * (2 * Math.PI)
}

// This buffer stores the angles of all
// the instanced bunnies.
const angleBuffer = regl.buffer({
  length: angle.length * 4,
  type: 'float',
  usage: 'dynamic'
})

const drawBunnies = regl({
  frag: `
  precision mediump float;
  varying vec3 vNormal;
  varying vec3 vColor;
  varying vec3 vPosition;
  varying vec3 vGlPosition;
  uniform vec3 focal;
  void main () {
    vec3 color = vColor;
    vec3 ambient = vec3(0.3) * color;
    vec3 lightDir = vec3(0.39, 0.87, 0.29);
    vec3 diffuse = vec3(0.7) * color * clamp(dot(vNormal, lightDir) , 0.0, 1.0 );
    gl_FragColor = vec4(ambient + diffuse, 1.0);
  }`,
  vert: `
  precision mediump float;
  attribute vec3 position;
  attribute vec3 normal;
  // These three are instanced attributes.
  attribute vec3 offset;
  attribute vec3 color;
  attribute float angle;
  uniform vec3 focal;
  uniform mat4 proj;
  uniform mat4 model;
  uniform mat4 view;
  varying vec3 vNormal;
  varying vec3 vColor;
  varying vec3 vPosition;
  varying vec3 vGlPosition;
  void main () {
    vNormal = normal;
    vColor = color;
    vPosition = position;
    gl_Position = proj * view * model * vec4(
      +cos(angle) * position.x + position.z * sin(angle) + offset.x,
      position.y + offset.y,
      -sin(angle) * position.x  + position.z * cos(angle) + offset.z,
      1.0);
    vGlPosition = gl_Position.xyz;
  }`,
  attributes: {
    position: bunny.positions,
    normal: normals(bunny.cells, bunny.positions),

    offset: {
      buffer: regl.buffer(
        Array(N * N).fill().map((_, i) => {
          var x = (-1 + 2 * Math.floor(i / N) / N) * 120
          var z = (-1 + 2 * (i % N) / N) * 120
          return [x, 0.0, z]
        })),
      divisor: 1
    },

    color: {
      buffer: regl.buffer(
        Array(N * N).fill().map((_, i) => {
          var x = Math.floor(i / N) / (N - 1)
          var z = (i % N) / (N - 1)
          return [
            x * z * 0.3 + 0.7 * z,
            x * x * 0.5 + z * z * 0.4,
            x * z * x + 0.35
          ]
        })),
      divisor: 1
    },

    angle: {
      buffer: angleBuffer,
      divisor: 1
    }
  },
  elements: bunny.cells,
  instances: N * N,
  uniforms: {
    focal: [0,0,0],
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
  varying vec3 vNormal;
  varying vec3 vColor;
  varying vec3 vPosition;
  varying vec3 vGlPosition;
  uniform vec3 focal;
  void main () {
    vec3 color = vColor;
    vec3 ambient = vec3(0.3) * color;
    vec3 lightDir = vec3(0.39, 0.87, 0.29);
    vec3 diffuse = vec3(0.7) * color * clamp(dot(vNormal, lightDir) , 0.0, 1.0 );
    float z = 1.0 - (abs(distance(focal, vGlPosition)) / 100.0);
    gl_FragColor = vec4(vec3(1.0,1.0,1.0) * z, 1.0);
  }`,
  vert: `
  precision mediump float;
  attribute vec3 position;
  attribute vec3 normal;
  // These three are instanced attributes.
  attribute vec3 offset;
  attribute vec3 color;
  attribute float angle;
  uniform vec3 focal;
  uniform mat4 proj;
  uniform mat4 model;
  uniform mat4 view;
  varying vec3 vNormal;
  varying vec3 vColor;
  varying vec3 vPosition;
  varying vec3 vGlPosition;
  void main () {
    vNormal = normal;
    vColor = color;
    vPosition = position;
    gl_Position = proj * view * model * vec4(
      +cos(angle) * position.x + position.z * sin(angle) + offset.x,
      position.y + offset.y,
      -sin(angle) * position.x  + position.z * cos(angle) + offset.z,
      1.0);
    vGlPosition = gl_Position.xyz;
  }`,
  attributes: {
    position: bunny.positions,
    normal: normals(bunny.cells, bunny.positions),

    offset: {
      buffer: regl.buffer(
        Array(N * N).fill().map((_, i) => {
          var x = (-1 + 2 * Math.floor(i / N) / N) * 120
          var z = (-1 + 2 * (i % N) / N) * 120
          return [x, 0.0, z]
        })),
      divisor: 1
    },

    color: {
      buffer: regl.buffer(
        Array(N * N).fill().map((_, i) => {
          var x = Math.floor(i / N) / (N - 1)
          var z = (i % N) / (N - 1)
          return [
            x * z * 0.3 + 0.7 * z,
            x * x * 0.5 + z * z * 0.4,
            x * z * x + 0.35
          ]
        })),
      divisor: 1
    },

    angle: {
      buffer: angleBuffer,
      divisor: 1
    }
  },
  elements: bunny.cells,
  instances: N * N,
  uniforms: {
    focal: [0,0,0],
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
    fragPosition = position;
    gl_Position = vec4(position, 0, 1);
  }`,
  attributes: {
    position: [ -4, -4, 4, -4, 0, 4 ]
  },
  uniforms: {
    tex: framebuffer,
    maptex: mapframebuffer,
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
  #define R int(8)

  void main() {
    float W =  float((1 + 2 * R) * (1 + 2 * R));
    
    vec4 avg = vec4(0.0);
    for (int x = -R; x <= +R; x++) {
      for (int y = -R; y <= +R; y++) {
        avg += (1.0 / W) * texture2D(tex, fragPosition + vec2(float(x) * wRcp, float(y) * hRcp));
      }
    }
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

regl.frame(({deltaTime, viewportWidth, viewportHeight}) => {
  framebuffer.resize(viewportWidth, viewportHeight);
  mapframebuffer.resize(viewportWidth, viewportHeight)

  setupDefault({}, () => {
    regl.clear({
      color: [0,0,0, 1],
      depth: 1,
    });

    // rotate the bunnies every frame.
    for (var i = 0; i < N * N; i++) {
      angle[i] += 0.01;
    }
    angleBuffer.subdata(angle);

    drawBunnies();
  });

  setupMap({}, () => {
    regl.clear({
      color: [0, 0, 0, 1],
      depth: 1,
    });

    drawBunniesMap();
  });

  regl.clear({
    color: [0, 0, 1, 1],
    depth: 1,
  });
  drawBufferBlurred();

  camera.tick();
})
