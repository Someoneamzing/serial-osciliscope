let connectButton;
let notSupported;
let port;
let decoder = new TextDecoderStream();
let inputDone;
let inputStream;
// let lastValues = Array.from({length: 255}, _=>({number: 0, time: 0}));
let strengths = [0,0,0,0];
let offset = 0;
let ws;
// let minGap = Infinity;
// // let minTime = Infinity;
// let maxTime = -Infinity;
// let lastSync = 0;
// let lastGap = Infinity;
// let lastGap2 = Infinity;

class LineBreakTransformer {
  constructor() {
    this.container = "";
  }

  transform(chunk, controller) {
    this.container += chunk;
    const lines = this.container.split(/\r?\n/g);
    this.container = lines.pop();
    for (let line of lines) controller.enqueue(line);
  }

  flush(controller) {
    controller.enqueue(this.container);
  }
}

class NumberTransformer {
  transform(chunk, controller) {
    const parts = chunk.split(',');
    controller.enqueue([parseInt(parts[0]), parseInt(parts[1])]);
  }

  flush(controller) {

  }
}

class ReaderIter {
  constructor(reader) {
    this.reader = reader;
  }

  next() {
    return this.reader.read()
  }
}

class Roller extends Array {
  constructor(length) {
    super(length);
    this.offset = 0;
  }

  add(e){
    this[this.offset] = e;
    this.offset = (this.offset + 1) % this.length;
  }

  prev() {
    return this[(this.offset + this.length - 1) % this.length];
  }
}

let last = null;
let sync = 0;
let tau = Infinity;
let avg_gap = Infinity;
let previous = new Roller(10);

function setup() {
  connectButton = document.getElementById('connect');
  notSupported = document.getElementById('not-supported');
  notSupported.classList.toggle('hidden', 'serial' in navigator);
  connectButton.onclick = async ()=>{
    if ('serial' in navigator) {
      port = await navigator.serial.requestPort();
      await port.open({baudRate: 115200});
      inputDone = port.readable.pipeTo(decoder.writable);
      inputStream = decoder.readable
      .pipeThrough(new TransformStream(new LineBreakTransformer()))
      .pipeThrough(new TransformStream(new NumberTransformer()));
      const reader = inputStream.getReader()
      reader[Symbol.asyncIterator] = ()=>new ReaderIter(reader);
      for await (let [time, value] of reader) {
        let last = previous.prev();
        if (last) {
          let gap = time - last.time;
          if (gap < 9 * tau) {
            console.log("Not a long gap");
            if (gap < tau) tau = gap;
            let space = time - sync;
            if (gap > 1.5 * tau) {
              if (space < 8 * tau) {
                console.log("We have an ID pulse");
                const id = Math.floor(space / (2 * tau))
                strengths[id] = value;
              }
            } else {
              console.log("We have a SYNC pulse");
              sync = time;
            }
          }
        }
        previous.add({time, value})
      }
    //   for await (let [time, number] of reader) {
    //     lastValues[offset].number = number;
    //     lastValues[offset].time = time;
    //     if (time > maxTime) maxTime = time;
    //     let last = (offset + lastValues.length - 1) % lastValues.length;
    //     if (lastValues[last].time > 0) {
    //       let gap = time - lastValues[last].time;
    //       // if (gap < minGap && gap > 10) minGap = gap;
    //       minGap = 47;
    //       console.log(gap, minGap);
    //       if (gap > 1.5 * minGap) {
    //         const space = time - lastSync;
    //         if (space < minGap * 7) {
    //           strengths[Math.round(space / (2 * minGap))] = number;
    //           console.log(`Last Space: ${space}`);
    //         }
    //       } else {
    //         console.log("Sync");
    //         lastSync = time;
    //       }
    //       console.log(`${lastGap2}, ${lastGap}, ${gap}`);
    //       lastGap2 = lastGap;
    //       lastGap = gap;
    //     }
    //     offset = (offset + 1) % lastValues.length;
    //   }
    //   console.log("Port closed.");
    //   reader.releaseLock()
    }
  }
  createCanvas(600, 600);
  ws = width / previous.length;
}

const colors = [[255, 0, 0], [0, 255, 0], [0,0,255], [255, 255, 0], [0,255,255]]

function draw() {
  background(255);
  for (let [i, strength] of strengths.entries()) {
    if (i > 4) break;
    fill(...colors[i])
    noStroke();
    rect(i * 40, 0, 40, strength / 1024 * height);
  }
  // stroke(255,0,0);
  // noFill();
  // beginShape()
  // for (let j = 0; j < lastValues.length; j ++) {
  //   const val = lastValues[j];
  //   if (val.time + 1000 > maxTime) {
  //     vertex((val.time - maxTime + 1000) / 1000 * width, 0);
  //     vertex((val.time - maxTime + 1000) / 1000 * width, val.number / 1024 * height);
  //     vertex((val.time - maxTime + 1000 + minGap / 2) / 1000 * width, val.number / 1024 * height);
  //     vertex((val.time - maxTime + 1000 + minGap / 2) / 1000 * width, 0);
  //   }
  // }
  // endShape();
  // stroke(0,255,0)
  // line((lastSync - maxTime + 1000) / 1000 * width, 0, (lastSync - maxTime + 1000) / 1000 * width, height)
  // stroke(0,0,255)
  // line((lastSync + minGap * 7 - maxTime + 1000) / 1000 * width, 0, (lastSync + minGap * 7 - maxTime + 1000) / 1000 * width, height)
}
