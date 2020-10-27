(function() {
  let canvas, gl;

  setup();

  function setup() {
    // Get the canvas element from the page.
    canvas = document.querySelector("#canvas");

    // Get the system DPI and scale the canvas accordingly so that it looks nice
    // on high DPI displays.
    const desiredWidth = 1000;
    const desiredHeight = 600;
    const dpi = window.devicePixelRatio || 1;
    canvas.width = desiredWidth * dpi;
    canvas.height = desiredHeight * dpi;
    canvas.style.width = desiredWidth + "px";
    canvas.style.height = desiredHeight + "px";

    // Get the WebGL context.
    gl = canvas.getContext("webgl");

    if (gl === null) {
      alert("Unable to start WebGL!");
      return;
    }

    // Clear the canvas
    gl.clearColor(1, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
})();
