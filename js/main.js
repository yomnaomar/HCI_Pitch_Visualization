
var mAudio = null;
AmCharts.useUTC = true;
var mChart = null;
var audioDuration;
var note_array = [];
var participants_files = [];
var task_data;
var timeline_start, timeline_end;
var pitchData = [], transcriptData = [], pitchDataInSec = [];
var redStartTimes = [], redEndTimes = [];
//var orangeStartTimes = [], orangeEndTimes = [];
var yellowStartTimes = [], yellowEndTimes = [];
var segmentPlayStart;
var logAudio = [];
//this variable is to mark whether the mouse select operation is executed so that it can be distinguished from click
var selection = false;
var selectedStart, selectedEnd;

window.onload = function () {
  Tipped.create('.legend-label')

  $.get('./data/participant_file.json', function (files) {
    participants_files = files;
    participants = _.map(files, 'id');
    _.each(participants, function (participant) {
      $('#participant_sel').append("<option value=" + participant + ">" + participant + "</option>");
    });
    $("#participant_sel").val("");
  });

  $('#participant_sel').on('change', function () {
    $('#task_sel').empty();

    let participant = $('#participant_sel').val();
    let tasks = _.find(participants_files, { 'id': parseInt(participant) }).tasks;
    _.each(tasks, function (task) {
      $('#task_sel').append("<option value=" + task.id + ">" + task.id + "</option>");
    });
    $("#task_sel").val("");
  });

  $('#task_sel').on('change', function () {
    let participant = $('#participant_sel').val();
    let task = $('#task_sel').val();

    task_data = _.find(_.find(participants_files, { 'id': parseInt(participant) }).tasks, { 'id': parseInt(task) });
      loadTaskData(task_data);
  });

  $('#addNote').on('click', function () {
    let note = {}
    let start = $('#start').val().split(":");
    let end = $('#end').val().split(":");
    note.startTime = (parseInt(start[0]) * 60.) + parseFloat(start[1]);
    note.endTime = (parseInt(end[0]) * 60.) + parseFloat(end[1]);
    note.width = ((note.endTime - note.startTime) / audioDuration) * 100 + '%';
    note.start = (note.startTime / audioDuration) * 100 + '%';
    note.color = randomColor();
    note.annotation = $('#annotation').val();
    note.prob = $('#probDescription').val();
    let timestamp = new Date().valueOf();;
    note.id = timestamp;
    note_array.push(note);

    $('#notes_timeline').append("<span class='timeline-element note_" + note.id + "' style='" +
      "width:" + note.width + ';left:' + note.start + ';background-color:' + note.color
      + "'></span>")

    $('#note-table').append(
      "<tr class=note_" + note.id + "><td>" + note.startTime + '</td>' +
      "<td>" + note.endTime + '</td>' +
      "<td>" + note.prob + '</td>' +
      "<td>" + note.annotation + '</td>' +
      "<td><i class='fa fa-trash-o delete-note' aria-hidden='true'></i></tr>"
    )

    $('.note_' + note.id + '> td > i').on('click', function () {
      $('.note_' + note.id).remove();
      _.remove(note_array, function (n) {
        return n.id == note.id;
      });
    });

    $('span.note_' + note.id).mouseover(function () {
      $('tr.note_' + note.id).css({ 'background-color': 'yellow' });
    });

    $('span.note_' + note.id).mouseout(function () {
      $('tr.note_' + note.id).css({ 'background-color': '' });
    });

    $('#start').val("");
    $('#end').val("");
    $('#annotation').val("");
    $('#probDescription').val("");
  });

  $('.timeline-outline').mousemove(function (ev) {
    updateOnMouseMove(ev);
  });

  $('#confirmFiles').on('click', function (ev) {
    // ev.preventDefault();
    $('.participant-selection').addClass('hidden');
  });

  $.key('ctrl+shift+s', function () {
    let audioLog = JSON.stringify(logAudio);
    let jsonData = JSON.stringify(note_array);

    let participant = $('#participant_sel').val();
    let task = $('#task_sel').val();

    let filename = 'uxproblem_' + participant + '_' + task + '_' + Date.now() + '.json'
    let audioFile = 'audioLog_' + participant + '_' + task + '_' + Date.now() + '.json'

    download(jsonData, filename, 'text/plain');
    download(audioLog, audioFile, 'text/plain');
  });

  $("#red_issue").change(function () {
    hidePopups()
    var $checkbox = $(this);
        if ($checkbox.prop('checked')) {
            highlightIssues('red', "#B71C1C");
        } else {
            $('#notes_timeline').empty();
            //$('#orange_issue').prop('checked', false);
            $('#yellow_issue').prop('checked', false);
        }

  });

  // $("#orange_issue").change(function () {
  //   hidePopups()
  //   var $checkbox = $(this);
  //   if ($checkbox.prop('checked')) {
  //     highlightIssues('orange', "#E65100");
  //   } else {
  //     $('#notes_timeline').empty();
  //     $('#red_issue').prop('checked', false);
  //     $('#yellow_issue').prop('checked', false);
  //   }
  // });

  $("#yellow_issue").change(function () {
    hidePopups()
    var $checkbox = $(this);
    if ($checkbox.prop('checked')) {
      highlightIssues('yellow', "#FFEE58");
    } else {
      $('#notes_timeline').empty();
      $('#red_issue').prop('checked', false);
      //$('#orange_issue').prop('checked', false);
    }
  });

  setTranscriptSelectionEventListener();
};

function updateOnMouseMove(event) {
  let width = $("#notes_timeline").width();
  let x_pos = event.pageX - $("#notes_timeline").parent().offset().left;

  let time = ((x_pos / width) * (timeline_end - timeline_start) + timeline_start) * 1000;

  updateTranscript(time);
  drawTimeIndicator(time);
  var currentDate = new Date(Math.floor(time));
  if (mChart != null) {
    mChart.panels[0].chartCursor.showCursorAt(currentDate);
  }
};

function download(text, name, type) {
  var a = document.createElement("a");
  var file = new Blob([text], { type: type });
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
}

function loadTaskData() {  //load the audio when the UI is displayed
  mAudio = document.getElementById("audiocontrol");
  mAudio.src = task_data.audio;
  mAudio.addEventListener('loadedmetadata', processAudio);
  mAudio.addEventListener('play', recordStart);
  mAudio.addEventListener('pause', recordEnd);
  //check audio's loading status. if it is not ready, load it again
  if (mAudio.readyState >= 2) {
    processAudio();
  }

  [transcriptData, pitchData] = parseData(task_data.data);

  setTimeout(myTimer, 500);
    function myTimer() {
        if (pitchData.length != 0 && transcriptData.length != 0) {
            console.log("data is being prepared...");

            //map pitch data to seconds
            pitchDataInSec.push(pitchData[0]);
            let max = pitchDataInSec[0]["data"];
            let min = pitchDataInSec[0]["data"];
            for (i = 1; i < pitchData.length; i++) {
                if (Math.floor(pitchData[i]["time"] / 1000) >= pitchDataInSec.length) {
                    pitchDataInSec.push(pitchData[i]);
                    if (max < pitchData[i]["data"])
                        max = pitchData[i]["data"];
                    if (min > pitchData[i]["data"])
                        min = pitchData[i]["data"];

                }
            }
            
            let avg = getAverage();
            let sd = getStandardDev(avg);
            let step = 10;
            identifyRedEmotions(avg, step, max, sd);

            //identifyOrangeEmotions(avg, step, min, sd);

            let diff = 10;
            identifyYellowEmotions(avg, step, diff);

            console.log("data is ready...");
            mChart = drawCharts();
            drawTranscript();
        }
        else {
            setTimeout(myTimer, 500);
        }
    }

};

function getAverage() {
    var sum = 0;
    for (var i = 0; i < pitchDataInSec.length; i++) {
        sum += pitchDataInSec[i]["data"]; //don't forget to add the base
    }
    var avg = sum / pitchDataInSec.length;
    return avg;
}

function getStandardDev(avg) {
    var sum = 0; 
    for (var i = 0; i < pitchDataInSec.length; i++) {
        sum += Math.pow((pitchDataInSec[i]["data"] - avg), 2); //don't forget to add the base
    }
    var sd = sum / pitchDataInSec.length;
    sd = Math.sqrt(sd);
    return sd;
}

function identifyRedEmotions(avg, step, max, sd) {
    var starts = [], ends = [0];
    var idx = 0;
    for (var i = 0; i < pitchDataInSec.length; i++) {
        if (pitchDataInSec[i]["data"] >= max - sd
            /*&& Math.abs(pitchDataInSec[i+1]["data"] - max) <= sd
            && Math.abs(pitchDataInSec[i+2]["data"] - max) <= sd*/) {
            let t = pitchDataInSec[i]["time"] / 1000 //convert millisec to seconds 
            if (ends[ends.length - 1] < t || starts.length == 0) {
                if (t - step >= 0 && ends[ends.length - 1] <= t - step)
                    starts.push(t - step); // start step seconds earlier
                else
                    starts.push(t);
                if (ends.length < starts.length)   //1, 0 -> 1, 1 yes;  1,2->no
                    ends.push(t + step + 1); //end step seconds after
                else
                    ends[ends.length - 1] = t + step // rewrite the end time
            }
        }
    }
    redStartTimes = starts;
    redEndTimes = ends;
}

// function identifyOrangeEmotions(avg, step, min, sd) {
//     var starts = [], ends = [0];
//     var idx = 0;
//     for (var i = 0; i < pitchDataInSec.length; i++) {
//         if (pitchDataInSec[i]["data"] <= min + sd) {
//             let t = pitchDataInSec[i]["time"] / 1000 //convert millisec to seconds 
//             if (ends[ends.length - 1] < t || starts.length == 0) {
//                 if (t - step >= 0 && ends[ends.length - 1] <= t - step)
//                     starts.push(t - step); // start step seconds earlier
//                 else
//                     starts.push(t);
//                 if (ends.length < starts.length)   //1, 0 -> 1, 1 yes;  1,2->no
//                     ends.push(t + step + 1); //end step seconds after
//                 else
//                     ends[ends.length - 1] = t + step // rewrite the end time
//             }
//         }
//     }
//     orangeStartTimes = starts;
//     orangeEndTimes = ends;
// }

function identifyYellowEmotions(avg, step, diff) {
    var starts = [], ends = [0];
    var idx = 0;
    for (var i = 1; i < pitchDataInSec.length - 2; i++) {
        if (Math.abs(pitchDataInSec[i]["data"] - (pitchDataInSec[i - 1]["data"])) <= diff
            && Math.abs(pitchDataInSec[i]["data"] - (pitchDataInSec[i + 1]["data"])) <= diff
            && Math.abs(pitchDataInSec[i]["data"] - (pitchDataInSec[i + 2]["data"])) <= diff) {
            let t = pitchDataInSec[i]["time"] / 1000 //convert millisec to seconds 
            if (ends[ends.length - 1] < t || starts.length==0 ) {
                if (t - step >= 0 && ends[ends.length - 1] <= t - step)
                    starts.push(t - step); // start step seconds earlier
                else
                    starts.push(t);
                if (ends.length < starts.length)   //1, 0 -> 1, 1 yes;  1,2->no
                    ends.push(t + step+1); //end step seconds after
                else
                    ends[ends.length - 1] = t+step // rewrite the end time
            }
        }
    }
    yellowStartTimes = starts;
    yellowEndTimes = ends;
}


function recordStart() {
  segmentPlayStart = mAudio.currentTime;
}

function recordEnd() {
  let segment = [segmentPlayStart, mAudio.currentTime];
  logAudio.push(segment);
}

function processAudio() {
  audioDuration = mAudio.duration;
  //console.log(mAudio.duration);
  timeline_start = 0;
  timeline_end = audioDuration;
}

function parseData(dataset_url) {
  var transcriptData = [];
  var pitchData = [];
  AmCharts.loadFile(dataset_url, {}, function (data) {
    inputdata = AmCharts.parseJSON(data);
    for (var i = 0; i < inputdata.length; i++) {
      var start = parseInt(parseFloat(inputdata[i].start_time) * 1000);
      var end = parseInt(parseFloat(inputdata[i].end_time) * 1000);
      var value = inputdata[i].transcription;
      var numWords = value.split(" ").length;
      //console.log("numWords: " + numWords);
      transcriptData.push({ "start": start, "end": end, "label": String(value).trim() });

      var temppitchData = inputdata[i].pitch;
      for (var j = 0; j < temppitchData.length; j++) {
        var time = start + j * (end - start) / temppitchData.length;
        pitchData.push({ "time": time, "data": parseFloat(temppitchData[j]), "legendColor": AmCharts.randomColor, "label": "undefined" });
      }

    }
    });
  return [transcriptData, pitchData];
}

//draw a line graph of the feature (e.g., pitch)
function drawCharts() {
  var chart = null;
  chart = AmCharts.makeChart("chartdiv", {
    "type": "stock",
    "theme": "light",
    dataSets: [{
      fieldMappings: [{
        fromField: "data",
        toField: "data2"
      },
      {
        fromField: "label",
        toField: "label2"
      },
      {
        fromField: "legendColor",
        toField: "legendColor"
      }
      ],
      dataProvider: pitchData,
      categoryField: "time",
      compared: false
    }],
    panels: [{
      showCategoryAxis: true,
      title: "Pitch (Hz)",
      allowTurningOff: false,
      stockGraphs: [{
        id: "g2",
        compareGraphType: "smoothedLine",
        valueField: "data2",
        compareField: "data2",
        comparable: false,
        visibleInLegend: true,
        showBalloon: false,
        lineColorField: "lineColor",
      }],
      stockLegend: {
        enabled: true,
        markType: "none",
        markSize: 0
      },
      listeners: [
        {
          event: "zoomed",
          method: handleZoom
        }, {
          event: "changed",
          method: handleMousemove,
        }],
    }
    ],
    valueAxesSettings: {
      labelsEnabled: false
    },
    categoryAxesSettings: {
      groupToPeriods: ['fff', 'ss'], // specify period grouping
      parseDates: true,
      autoGridCount: false,
      dateFormats: [{
        period: "fff",
        format: "JJ:NN:SS"
      }, {
        period: "ss",
        format: "JJ:NN:SS"
      }, {
        period: "mm",
        format: "JJ:NN:SS"
      }, {
        period: "hh",
        format: "JJ:NN:SS"
      }, {
        period: "DD",
        format: "MMM DD"
      }, {
        period: "WW",
        format: "MMM DD"
      }, {
        period: "MM",
        format: "MMM"
      }, {
        period: "YYYY",
        format: "YYYY"
      }],
      //"equalSpacing": true,
      minPeriod: "fff"
    },
    chartScrollbarSettings: {
      enabled: true,
      graph: "g2",
      usePeriod: "fff",
      position: "top",
      dragIcon: "dragIconRoundSmall",
      selectedGraphLineColor: "#888888",
    },
    chartCursor: {
      categoryBalloonDateFormat: "JJ:NN:SS",
    },
    chartCursorSettings: {
      valueBalloonsEnabled: false,
      fullWidth: false,
      cursorAlpha: 0.6,
      selectWithoutZooming: true
    },
    legend: {
      enabled: false
    }
    ,
    periodSelector: {
      labelStyle: 'hidden',
      position: "bottom",
      dateFormat: "JJ:NN:SS", // date format with milliseconds "NN:SS:QQQ"
      inputFieldsEnabled: false,
      inputFieldWidth: 100,
      periods: [{
        period: "MAX",
        label: "Show Full Graph",
        selected: true
      }]
    }
  });
  return chart;
}

function drawTranscript() {
  // three data fields: start, end, label
  var transcript = "";
  for (var i in transcriptData) {
    var value = transcriptData[i].label;
    transcript += String(value).trim() + "<br/>";
  }
  var x = document.getElementById("transcriptdiv");
  x.innerHTML = transcript;
}

//this function is to get the selected text and past it into the analysis note textarea as a quote.
function setTranscriptSelectionEventListener() {
  var transcript = document.getElementById('transcriptdiv');
  transcript.addEventListener('mouseup', transcriptMouseupHandler, false);
}

//handle selection events on the transcript view
function transcriptMouseupHandler() {
  var startTime = -1;
  var endTime = -1;
  var selectedtext = [];
  if (window.getSelection) {
    selectedtext = window.getSelection().toString().split("\n");
    //console.log("# sents selected: " + selectedtext.length);
    if (selectedtext.length > 1) {
      var startsentence = selectedtext[0];
      var endsentence = selectedtext[selectedtext.length - 1];
      //console.log("startsentence: " + startsentence);
      for (var j = 0; j < transcriptData.length - selectedtext.length; j++) {
        var value = transcriptData[j].label.toString().trim();
        var endvalue = transcriptData[j + selectedtext.length - 1].label.toString().trim();
        if ((value == startsentence || value.includes(startsentence)) && (endvalue == endsentence || endvalue.includes(endsentence))) {
          startTime = parseFloat(transcriptData[j].start);
          var endindex = j + selectedtext.length + 1 > transcriptData.length - 1 ? transcriptData.length - 1 : j + selectedtext.length + 1;
          endTime = parseFloat(transcriptData[endindex].start);
          //console.log("start: " + startTime + "; end: " + endTime);
          break;
        }
      }
    }
    else if (selectedtext.length == 1) {
      var startsentence = selectedtext[0];
      for (var j = 0; j < transcriptData.length; j++) {
        var value = transcriptData[j].label.toString().trim();
        if (value == startsentence) {
          startTime = parseFloat(transcriptData[j].start);
          endTime = parseFloat(transcriptData[j + 1].start);
          //console.log("start: " + startTime + "; end: " + endTime);
          break;
        }
      }
    }

    if (startTime >= 0) {
      var startInSecs = parseInt(startTime / 1000);
      var endInSecs = parseInt(endTime / 1000);
      var startMins = parseInt(startInSecs / 60);
      var startSecs = startInSecs - startMins * 60;
      var endMins = parseInt(endInSecs / 60);
      var endSecs = endInSecs - endMins * 60;
      document.getElementById("start").value = startMins + ":" + startSecs; //convert the miliseconds into seconds
      document.getElementById("end").value = endMins + ":" + endSecs; //convert the miliseconds into seconds

      mAudio.currentTime = startInSecs; //convert the miliseconds into seconds
      mAudio.pause();
      mChart.validateData();
      var currentDate = new Date(Math.floor(startTime));
      mChart.panels[0].chartCursor.showCursorAt(currentDate);
      drawTimeIndicator(currentDate);
      updateTranscriptOnSelection(startInSecs, endInSecs);
        highlightNoteTimeline(startInSecs, endInSecs);


    }
  }
}

//handle mousemove event on the line graph
//synchronize the mouse cursor with the transcript
function handleMousemove(e) {
  //console.log(e.chart.chartCursor.timestamp);
  var timestamp = parseFloat(e.chart.chartCursor.timestamp);
  //console.log("handleMousemove");
  if (selection == false)
    updateTranscript(timestamp);
  drawTimeIndicator(timestamp);
}

function drawTimeIndicator(timestamp) {
  //console.log("timestamp: "+ timestamp);
  let time = timestamp / 1000;
  let total_duration = timeline_end - timeline_start;
  let start = ((time - timeline_start) / total_duration) * 100;

  $('.timeline-indicator').remove();

  if (start < 100 && start > 0) {
    start = start + '%'
    $('#notes_timeline').append("<span class='timeline-element timeline-indicator' style='" +
      "width:0%" + ';left:' + start + "'></span>")
  }

}

//highlight the corresponding segment in the note  timeline when a portion of the transcript is selected
function highlightNoteTimeline(startTime, endTime) { //#00FFFFFF
  $('#notes_timeline').empty();
  let duration = timeline_end - timeline_start;
  _.each(note_array, function (label) {
    //console.log("label.start:" + label.startTime + "; timeline_end :" + timeline_end);
    let end = ((label.endTime - timeline_start) / duration) * 100;
    let start = ((label.startTime - timeline_start) / duration) * 100;
    if (Math.max(start, 0) < Math.min(100, end)) {
      start = Math.max(0, start);
      let width = Math.min(100, end) - start;
      label.start = start + '%';
      label.width = width + '%';
      $('#notes_timeline').append("<span class='timeline-element' style='" +
        "width:" + label.width + ';left:' + label.start + ';background-color:' + label.color
        + "' title=" + label.annotation + " value=" + label.startTime + "></span>")
    }
  });

  //hight the mouse selected portion's backgroud color
  let end = ((endTime - timeline_start) / duration) * 100;
  let start = ((startTime - timeline_start) / duration) * 100;
  if (Math.max(start, 0) < Math.min(100, end)) {
    start = Math.max(0, start);
    let width = Math.min(100, end) - start;
    highlightStart = start + '%';
    hightWidth = width + '%';
    $('#notes_timeline').append("<span class='timeline-element' style='" +
      "width:" + hightWidth + ';left:' + highlightStart + '; height: 568px' + ';background-color: #B0B0B0; opacity: 0.6'
      + "'></span>")
  }
}

function highlightIssues(colorName, color) {
    let slices = getIssueTimes(colorName)
    let len = slices[0].length
    if (len > 0) {
        for (i = 0; i < len; i++) {
            highlightSingleIssue(slices[0][i], slices[1][i], color);
        }
    }
    else {
        noIssueMessage(colorName)
    }

}

// When no issues found open the popup
function noIssueMessage(color) {
    var popup = document.getElementById(color+"Popup");
    popup.classList.toggle("show");
}

function hidePopups() {
    var x = document.getElementById("redPopup");
    if (x.classList.value == "popuptext show")
        x.classList.value = "popuptext";
    // x = document.getElementById("orangePopup");
    // if (x.classList.value == "popuptext show")
    //     x.classList.value = "popuptext";
    x = document.getElementById("yellowPopup");
    if (x.classList.value == "popuptext show")
        x.classList.value = "popuptext";
}

function getIssueTimes(colorName) {
    let startTimes;
    let endTimes;
    switch (colorName) {
        case "red":
            startTimes = redStartTimes;
            endTimes = redEndTimes;
            break;
        // case "orange":
        //     startTimes = orangeStartTimes;
        //     endTimes = orangeEndTimes;
        //     break;
        case "yellow":
            startTimes = yellowStartTimes;
            endTimes = yellowEndTimes;
            break;
    }
    return [startTimes, endTimes]
}

function highlightSingleIssue(startTime, endTime, color) {
  let duration = timeline_end - timeline_start;
  _.each(note_array, function (label) {
    //console.log("label.start:" + label.startTime + "; timeline_end :" + timeline_end);
    let end = ((label.endTime - timeline_start) / duration) * 100;
    let start = ((label.startTime - timeline_start) / duration) * 100;
    if (Math.max(start, 0) < Math.min(100, end)) {
      start = Math.max(0, start);
      let width = Math.min(100, end) - start;
      label.start = start + '%';
      label.width = width + '%';
      $('#notes_timeline').append("<span class='timeline-element' style='" +
        "width:" + label.width + ';left:' + label.start + ';background-color:' + label.color
        + "' title=" + label.annotation + " value=" + label.startTime + "></span>")
    }
  });

  //hight the mouse selected portion's backgroud color
  let end = ((endTime - timeline_start) / duration) * 100;
  let start = ((startTime - timeline_start) / duration) * 100;
  if (Math.max(start, 0) < Math.min(100, end)) {
    start = Math.max(0, start);
    let width = Math.min(100, end) - start;
    highlightStart = start + '%';
    hightWidth = width + '%';
    $('#notes_timeline').append("<span class='timeline-element' style='" +
      "width:" + hightWidth + ';left:' + highlightStart + '; height: 565px' + ';background-color: ' + color + '; opacity: 0.25'
      + "'></span>")
  }
}

//this function is to sync the transcript with the feature graph when the mouse moves over the graph
function updateTranscript(currentTimeInMS) {
  var transcript = "";
  for (var i in transcriptData) {
    var value = transcriptData[i].label;
    var start = parseFloat(transcriptData[i].start);
    var end = parseFloat(transcriptData[i].end);

    //console.log("timestamp: " + e.chart.chartCursor.timestamp + " , start: " + start + ", end: " + end + " , word: " + value);
    if (currentTimeInMS >= start && currentTimeInMS <= end) {
      transcript += "<span class='transcript-line highlight'>" + String(value).trim() + "<br/>" + "</span>";
    }
    else {
      transcript += "<span class='transcript-line'>" + String(value).trim() + "<br/>" + "</span>";
    }
  }

  var x = document.getElementById("transcriptdiv");
  x.innerHTML = transcript;

  let previousLines = $('.highlight').prevAll('.transcript-line')
  //
  if (previousLines.length > 20) {
    previousLines.get(20).scrollIntoView();
  }
}

//this function is to highlight the corresponding part in the transcript when a portion of the graph is selected
function updateTranscriptOnSelection(startTime, endTime) {
  //console.log("update: " + startTime + "; end: " + endTime);``
  var transcript = "";
  for (var i = 0; i < transcriptData.length - 1; i++) {
    var value = transcriptData[i].label;
    var start = parseFloat(transcriptData[i].start);
    var end = parseFloat(transcriptData[i + 1].start);

    //console.log("timestamp: " + e.chart.chartCursor.timestamp + " , start: " + start + ", end: " + end + " , word: " + value);
    if (start >= parseFloat(startTime) * 1000 && end <= parseFloat(endTime) * 1000) {
      //console.log("transcript: " + start + "; end: " + end);
      transcript += "<span class='transcript-line highlight'>" + String(value).trim() + "<br/>" + "</span>";
    }
    else {
      transcript += "<span class='transcript-line'>" + String(value).trim() + "<br/>" + "</span>";
    }
  }

  var x = document.getElementById("transcriptdiv");
  x.innerHTML = transcript;

  let previousLines = $('.highlight').first().prevAll('.transcript-line')
}

function handleZoom(event) {
    timeline_start = moment.duration(event.startValue).asMilliseconds() / 1000.0;
    timeline_end = moment.duration(event.endValue).asMilliseconds() / 1000.0;

    //toggle the checkboxes when zoomed in order to update highlight
    var x = document.getElementById("red_issue");
    if (x.checked == true) {
        x.click();
        x.click();
    }
    // x = document.getElementById("orange_issue");
    // if (x.checked == true) {
    //     x.click();
    //     x.click();
    // }
    x = document.getElementById("yellow_issue");
    if (x.checked == true) {
       x.click();
       x.click();
    }
}

setTimeout(myTimer2, 500);

function myTimer2() {
  if (mChart != null && mAudio != null) {
    //console.log("charts and the audio control are both ready...");
    connectAudioCharts();
    connectMouseEvents();
  }
  else {
    setTimeout(myTimer2, 500);
  }
}

function connectAudioCharts() {
  mAudio.addEventListener("timeupdate", function (e) {
    //console.log("time: " + e.target.currentTime);
    var currentDate = new Date(Math.floor(e.target.currentTime * 1000));
    for (var x in mChart.panels) {
      //console.log("set panel  " + x);
      mChart.panels[x].chartCursor.showCursorAt(currentDate);
    }
  });
}

function connectMouseEvents() {
  //console.log("connecting mouse events... ");
  for (var x in mChart.panels) {
    //console.log("set panel  " + x);
    mChart.panels[x].chartCursor.addListener("changed", AmCharts.myHandleMove);
    mChart.panels[x].chartDiv.addEventListener("mousedown", AmCharts.myHandleClick);
    mChart.panels[x].chartCursor.addListener("selected", handleSelection);
  }
}

AmCharts.myHandleMove = function (event) {
  if (undefined === event.index)
    return;
  AmCharts.myCurrentPosition = event.chart.dataProvider[event.index].time;
}

AmCharts.myHandleClick = function (event) {
  if (selection === false) {
    //console.log("clicked");
    for (var x in mChart.panels) {
      //console.log("time: " + AmCharts.myCurrentPosition.getTime());
      mAudio.currentTime = AmCharts.myCurrentPosition.getTime() / 1000; //convert the miliseconds into seconds
      mAudio.pause();
    }
  }
  else {
    selection = false;
  }
  $('.backhigh').remove();
}

// mouse selection event handler for the feature graph
function handleSelection(event) {
  //console.log("selected");
  selection = true;
  //console.log("event.start: " + event.start);
  //console.log("event.end: " + event.end);
  var startInSecs = parseFloat(event.start / 1000);
  var endInSecs = parseFloat((event.end + 1) / 1000);
  var startMins = parseInt(startInSecs / 60);
  var startSecs = startInSecs - startMins * 60;

  var endMins = parseInt(endInSecs / 60);
  var endSecs = endInSecs - endMins * 60;

  document.getElementById("start").value = startMins + ":" + startSecs; //convert the miliseconds into seconds
  document.getElementById("end").value = endMins + ":" + endSecs; //convert the miliseconds into seconds

  updateTranscriptOnSelection(startInSecs, endInSecs);

  mAudio.currentTime = startInSecs; //convert the miliseconds into seconds
  mAudio.pause();
  //console.log("startInSecs: " + startInSecs);
  drawTimeIndicator(startInSecs);
  highlightNoteTimeline(startInSecs, endInSecs);
  mChart.validateData();
}

// handle keyboard press event
document.addEventListener('keydown', function (e) {
  //press ESC to start/pause audo play
  if (e.keyCode == 27) {
    if (mAudio != null && mAudio.paused) {
      mAudio.play();
    }
    else if (mAudio != null && !mAudio.paused) {
      mAudio.pause();
    }
  }
});
