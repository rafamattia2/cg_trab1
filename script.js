"use strict";
//testt
var vs = `#version 300 es

in vec4 a_position;
in vec4 a_color;

uniform mat4 u_matrix;

out vec4 v_color;

void main() {
  // Multiply the position by the matrix.
  gl_Position = u_matrix * a_position;

  // Pass the color to the fragment shader.
  v_color = a_color;
}
`;

var fs = `#version 300 es
precision highp float;

// Passed in from the vertex shader.
in vec4 v_color;

uniform vec4 u_colorMult;
uniform vec4 u_colorOffset;

out vec4 outColor;

void main() {
   outColor = v_color * u_colorMult + u_colorOffset;
}
`;

var Node = function() {
  this.children = [];
  this.localMatrix = m4.identity();
  this.worldMatrix = m4.identity();
};

Node.prototype.setParent = function(parent) {
  // remove us from our parent
  if (this.parent) {
    var ndx = this.parent.children.indexOf(this);
    if (ndx >= 0) {
      this.parent.children.splice(ndx, 1);
    }
  }

  // Add us to our new parent
  if (parent) {
    parent.children.push(this);
  }
  this.parent = parent;
};

Node.prototype.updateWorldMatrix = function(matrix) {
  if (matrix) {
    // a matrix was passed in so do the math
    m4.multiply(matrix, this.localMatrix, this.worldMatrix);
  } else {
    // no matrix was passed in so just copy.
    m4.copy(this.localMatrix, this.worldMatrix);
  }

  // now process all the children
  var worldMatrix = this.worldMatrix;
  this.children.forEach(function(child) {
    child.updateWorldMatrix(worldMatrix);
  });
};


function updatePosition(index) {
        return function(event, ui) {
            trans[index] = ui.value;
            // drawScene();
        };
    }
function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  var canvas = document.querySelector("#canvas");
  var gl = canvas.getContext("webgl2");
  var teste = document.getElementById('x');

  // Create a buffer

  if (!gl) {
    return;
  }

  const data = {
    tolerance: 0.15,
    distance: .4,
    divisions: 16,
    startAngle: 0,
    endAngle: Math.PI * 2,
    capStart: true,
    capEnd: true,
  };

  var program = webglUtils.createProgramFromSources(gl,
        [vs, fs]);

    // look up where the vertex data needs to go.
  var positionAttributeLocation = gl.getAttribLocation(program, "a_position");
  var trans = [0, 0];
    // look up uniform locations
  var positionBuffer = gl.createBuffer();
    //Create a vertex array object (attribute state)
  var vao = gl.createVertexArray();
    //
    // and make it the one we're currently working with
     gl.bindVertexArray(vao);
    //
    // Turn on the attribute
    gl.enableVertexAttribArray(positionAttributeLocation);
    //
    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Tell the twgl to match position with a_position, n
  // normal with a_normal etc..
  twgl.setAttributePrefix("a_");

  var sphereBufferInfo = flattenedPrimitives.createSphereBufferInfo(gl, 10, 15, 6);

  // setup GLSL program
  var programInfo = twgl.createProgramInfo(gl, [vs, fs]);

  var sphereVAO = twgl.createVAOFromBufferInfo(gl, programInfo, sphereBufferInfo);

  function degToRad(d) {
    return d * Math.PI / 180;
  }

  var fieldOfViewRadians = degToRad(60);

  var objectsToDraw = [];
  var objects = [];

  // Let's make all the nodes
  var solarSystemNode = new Node();
  var earthOrbitNode = new Node();
  // earth orbit 100 units from the sun
  earthOrbitNode.localMatrix = m4.translation(100, 20, 0);

  var moonOrbitNode = new Node();
  // moon 20 units from the earth
  moonOrbitNode.localMatrix = m4.translation(30, 3, 0);

  var sunNode = new Node();
  sunNode.localMatrix = m4.scaling(-5, 5, 5);  // sun a the center
  sunNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0.6, 0.6, 0, 1], // yellow
      u_colorMult:   [0.4, 0.4, 0, 1],
    },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  };

  var earthNode = new Node();

  // make the earth twice as large
  earthNode.localMatrix = m4.scaling(2, 2, 2);   // make the earth twice as large
  earthNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
      u_colorMult:   [0.8, 0.5, 0.2, 1],
    },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  };

  var moonNode = new Node();
  moonNode.localMatrix = m4.scaling(0.4, 0.4, 0.4);
  moonNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0.6, 0.6, 0.6, 1],  // gray
      u_colorMult:   [0.1, 0.1, 0.1, 1],
    },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  };

  // connect the celetial objects
  sunNode.setParent(solarSystemNode);
  earthOrbitNode.setParent(solarSystemNode);
  earthNode.setParent(earthOrbitNode);
  moonOrbitNode.setParent(earthOrbitNode);
  moonNode.setParent(moonOrbitNode);

  var objects = [
    sunNode,
    earthNode,
    moonNode,
  ];

  var slidersBuffer = {x : 0, y: 0, z: 0, w: 0};

  var vxs = {
    A: [-380.884671371422,-140.0698245324645],
    B: [-450.2055192201519,580.7875056290826],
    C: [10.5387352999922,-280.919911862778],
    D: [-90.5279256641409,510.8501957709694],
    E: [0.5653170060827,-3.821094658705],
    F: [-2.9618632452938,-4.1889600836952],
    G: [-1.2307318335753,-6.3745134909898],
    H: [0, -8],
    I: [4, -6],
    J: [5, -4],
    K: [5.3692066736016,-1.440788967592],
    L: [3.5515186912972,-1.2027583984807],
    M: [3.9843015442268,1.0477124367534],
    
  };  
  
  var vxsCurves = {
    firstCurve : [vxs.A, vxs.B, vxs.C, vxs.D],
    secondCurve : [vxs.D, vxs.E, vxs.F, vxs.G],
    thirdCurve : [vxs.G, vxs.H, vxs.I, vxs.J],
    fourthCurve : [vxs.J, vxs.K, vxs.L, vxs.M]
  };

  function calculateIntermediateVertex(v1, v2, sliderValue) {
    // console.log("v1: " + v1 + " v2: " + v2 + " Slider Value: " + sliderValue);
    // const x = v1.x + (sliderValue+1) * (v2.x - v1.x);
    // const y = v1.y + (sliderValue+1) * (v2.y - v1.y);
    const v1v2t = {
      x: v1[0] + (sliderValue*0.01) * (v2[0] - v1[0]),
      y: v1[1] + (sliderValue*0.01) * (v2[1] - v1[1])
    };
    // console.log("Resultado: " + v1v2t.x +" "+ v1v2t.y)
    let arr =[v1v2t.x, v1v2t.y]
    // let arr =[x, y]
    // console.log("arr:" + arr);
    return arr;
  }

  function calculateIntermediateInArray(currentArray){
    let arrayBuffer = []
    //Calcula a posição da câmera na curva
    if (currentArray.length !== 1){
      for (let i = 0; i < currentArray.length-1; i++){
        // console.log("testeee: "+currentArray[i] + currentArray[i+1]) ||| ATÉ AQUI TA CERTO ( a principio kakakak)
        let intermediateVertex = calculateIntermediateVertex(currentArray[i], currentArray[i+1], slidersBuffer.w);
        // console.log("Intermediário: " + intermediateVertex);
        arrayBuffer.push(intermediateVertex);
      }
      return calculateIntermediateInArray(arrayBuffer);
    }else{
      console.log(currentArray);
      return currentArray;
    }
  }

  var objectsToDraw = [
    sunNode.drawInfo,
    earthNode.drawInfo,
    moonNode.drawInfo,
  ];
  // webglLessonsUI.setupSlider("#x", {slide: updatePosition(0), min: -(gl.canvas.width/2), max: gl.canvas.width/2});
  // webglLessonsUI.setupSlider("#y", {slide: updatePosition(1), min: -(gl.canvas.height/2), max: gl.canvas.height/2});
  // webglLessonsUI.setupSlider("#z", {slide: updatePosition(2), max: gl.canvas.height});
  // webglLessonsUI.setupSlider("#w", {slide: updatePosition(3), max: gl.canvas.height});
  webglLessonsUI.setupSlider("#x", {slide: updatePosition(0), min:-300, max: 300});
  webglLessonsUI.setupSlider("#y", {slide: updatePosition(1), min:-300, max: 300});
  webglLessonsUI.setupSlider("#z", {slide: updatePosition(2), min:-700, max: 300});
  webglLessonsUI.setupSlider("#w", {slide: updatePosition(3), max: 100});


  requestAnimationFrame(drawScene);

  // Draw the scene.
  function drawScene(time) {
    time *= 0.001;

    twgl.resizeCanvasToDisplaySize(gl.canvas);

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    // Clear the canvas AND the depth buffer.
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Compute the projection matrix
    var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    var projectionMatrix =
        m4.perspective(fieldOfViewRadians, aspect, 1, 2000);

    slidersBuffer.x = document.querySelector('#x .gman-widget-value').textContent;
    slidersBuffer.y = document.querySelector('#y .gman-widget-value').textContent;
    slidersBuffer.z = document.querySelector('#z .gman-widget-value').textContent;
    slidersBuffer.w = document.querySelector('#w .gman-widget-value').textContent;



    // Compute the camera's matrix using look at.
    var cameraPosition = [0-(10*slidersBuffer.x), -300-(1*slidersBuffer.y), 0-(10*slidersBuffer.z)];
    var cameraPositionBezier = calculateIntermediateInArray(vxsCurves.firstCurve);
    cameraPositionBezier[0].push(-100);

    console.log("Camera Position" + cameraPositionBezier);
    var target = [cameraPosition[0],-1+(10*slidersBuffer.w), cameraPosition[1]];
    var target2 = [0, 500, 0]
    var up = [0, 0, 1];
    var cameraMatrix = m4.lookAt(cameraPosition,
                                 cameraPositionBezier[0],
                                 up);

    // Make a view matrix from the camera matrix.
    var viewMatrix = m4.inverse(cameraMatrix);

    var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

    // update the local matrices for each object.
    m4.multiply(m4.yRotation(0.01), earthOrbitNode.localMatrix, earthOrbitNode.localMatrix);
    m4.multiply(m4.yRotation(0.01), moonOrbitNode.localMatrix, moonOrbitNode.localMatrix);
    // spin the sun
    m4.multiply(m4.yRotation(0.005), sunNode.localMatrix, sunNode.localMatrix);
    // spin the earth
    m4.multiply(m4.yRotation(0.05), earthNode.localMatrix, earthNode.localMatrix);
    // spin the moon
    m4.multiply(m4.yRotation(-0.05), moonNode.localMatrix, moonNode.localMatrix);

    // Update all world matrices in the scene graph
    solarSystemNode.updateWorldMatrix();

    // Compute all the matrices for rendering
    objects.forEach(function(object) {
        object.drawInfo.uniforms.u_matrix = m4.multiply(viewProjectionMatrix, object.worldMatrix);
    });

    // ------ Draw the objects --------
    twgl.drawObjectList(gl, objectsToDraw);
    // updatePosition(0)
    requestAnimationFrame(drawScene);
  }
}

main();
