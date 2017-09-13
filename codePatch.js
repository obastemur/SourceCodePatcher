var fs = require('fs');
var path = require('path');

var files = [];
var is_dir = fs.statSync(process.argv[2]).isDirectory();

var target_extensions = {
  '.c' : 1,
  '.cpp' : 1,
  '.h' : 1,
  '.hpp': 1,
  '.cc' : 1,
  '.inl': 1
};

// the list of files below are not good candidate for tracking.
// some of them initializes earlier than PAL, others miss references etc.
// they don't have any significant effect on engine call tree.
var exclude_files = [
  'lib/Common/DataStructures/UnitBitVector.h',
  'lib/ChakraCoreStatic.cpp',
  'lib/Parser/rterror.cpp',
  'lib/Parser/Hash.cp',
  'lib/Common/Util/Pinned.cpp'
];

if (process.platform == "win32") {
  var obj = [];
  for (var o=0; o < exclude_files.length; o++) {
    var file = exclude_files[o];
    obj.push(file.replace(/\//g, '\\'));
  }
  exclude_files = obj;
}

function skipFile(file_name) {
    for (var o=0; o < exclude_files.length; o++) {
      if (file_name.indexOf(exclude_files[o]) >= 0) {
        return true;
      }
    }
}

var LOG_MODE = false;

if(!is_dir) {
  files.push(process.argv[2]);
} else {
 // scan folder and add all the C/C++ source files
 function GetFiles(folder) {
   var dir_list = fs.readdirSync(folder);
   for(var i = 0; i < dir_list.length; i++) {
     var file = path.join(folder, dir_list[i]);
     if (fs.statSync(file).isDirectory()) {
       GetFiles(file);
     } else if (target_extensions[path.extname(file)] == 1){
       files.push(file);
     }
   }
 }
 GetFiles(process.argv[2]);
}

var known_words = {
  'class':0,
  'namespace':0,
  'try':1,
  'if':1,
  'else':1,
  'switch':0,
  'enum': 0,
  'struct': 0,
  'for':1,
  'do':1,
  'while':1,
  'case':1,
  'union':0
};

var injectIndexes = [];

function Parse(filename, data) {
  var CHAR_A = 'A'.charCodeAt(0), CHAR_Z = 'Z'.charCodeAt(0), CHAR_a = 'a'.charCodeAt(0),
               CHAR_SPACE = ' '.charCodeAt(0), CHAR_0 = '0'.charCodeAt(0),
               CHAR_9     = '9'.charCodeAt(0), CHAR_z = 'z'.charCodeAt(0),
               CHAR_DOUBLE_QUOTE = '"'.charCodeAt(0), CHAR_SINGLE_QUOTE = "'".charCodeAt(0),
               CHAR_UNDERSCORE = '_'.charCodeAt(0), CHAR_DOLLAR = '$'.charCodeAt(0),
               CHAR_LEFT_SL = '\\'.charCodeAt(0), CHAR_RIGHT_SL = '/'.charCodeAt(0),
               CHAR_WILDCARD = '*'.charCodeAt(0), CHAR_NEW_LINE = '\n'.charCodeAt(0),
               CHAR_OPEN_PR = '('.charCodeAt(0), CHAR_CLOSE_PR = ')'.charCodeAt(0),
               CHAR_OPEN_BRACKET = '{'.charCodeAt(0), CHAR_EQUAL = '='.charCodeAt(0),
               CHAR_CLOSE_BRACKET = '}'.charCodeAt(0), CHAR_HASHTAG = '#'.charCodeAt(0),
               CHAR_LT = '<'.charCodeAt(0), CHAR_GT = '>'.charCodeAt(0), CHAR_COMMA = ','.charCodeAt(0);

  function IsWord(ch) {
    return (ch >= CHAR_A && ch <= CHAR_Z) || (ch >= CHAR_a && ch <= CHAR_z) ||
           (ch >= CHAR_0 && ch <= CHAR_9) || (ch == CHAR_UNDERSCORE) || (ch == CHAR_DOLLAR) ||
           (ch == CHAR_EQUAL) || (ch == CHAR_HASHTAG) || (ch == CHAR_LT) || (ch == CHAR_GT) ||
           (ch == CHAR_COMMA);
  }
  var prev_ch = 0;
  var ch_repeats = 0;
  var prev_ch_repeats = 0;
  var string_has_started = 0;
  var string_start_char = 0;
  var last_word = "";
  var current_word = "";
  var single_comment_started = 0;
  var multi_comment_started = 0;
  var line_index = 0, col_index = 0;
  var last_known_word = "";
  var open_pr_count = 0;
  var new_word_since_pr_is_closed = 0;
  var new_word_since_br_is_opened = 0;

  var issue_current_word = function() {
    if (current_word.length) {
      new_word_since_br_is_opened++;
      if (LOG_MODE) {
        console.log("current_word->", current_word);
      }
      if (new_word_since_br_is_opened == 2) {
        if (current_word == ',') {
          // delete print log
          if(LOG_MODE) {
            console.log("Special Condition -> ... { item, ... deleting the last injectIndex");
          }
          injectIndexes.pop();
        }
      }
      if (known_words.hasOwnProperty(current_word)) {
        last_known_word = current_word;
        open_pr_count = 0;
      }
      new_word_since_pr_is_closed++;
      last_word = current_word;
      current_word = "";
    }
  }
  for(var i = 0; i < data.length; i++) {
    var ch = data.charCodeAt(i);
    if (prev_ch == ch) ch_repeats++; else { ch_repeats = 0; prev_ch_repeats = ch_repeats; }

    if (!single_comment_started && !multi_comment_started && !string_has_started && IsWord(ch)) {
      var str_ch = String.fromCharCode(ch);
      if (str_ch == ',') {
        issue_current_word();
        current_word = ',';
        issue_current_word();
      } else {
        current_word += str_ch;
      }
    } else {
      issue_current_word();
      switch (ch) {
        case CHAR_CLOSE_BRACKET:
          if (!single_comment_started && !multi_comment_started && !string_has_started) {
            open_pr_count = 0;
            last_known_word = "";
          }
          break;
        case CHAR_OPEN_PR:
          if (!single_comment_started && !multi_comment_started && !string_has_started) {
            if (new_word_since_br_is_opened < 2)
              new_word_since_br_is_opened = 0;
            open_pr_count++;
          }
          break;
        case CHAR_CLOSE_PR:
          if (!single_comment_started && !multi_comment_started && !string_has_started) {
            if (open_pr_count) {
              open_pr_count--;
              if (open_pr_count == 0) {
                new_word_since_pr_is_closed = 0;
              }
            }
          }
          break;
        case CHAR_WILDCARD:
          if (!string_has_started) {
            if (prev_ch == CHAR_RIGHT_SL) {
              multi_comment_started = true;
            }
          }
          break;
        case CHAR_NEW_LINE:
          single_comment_started = false;
          line_index++;
          col_index = 0;
          break;
        case CHAR_RIGHT_SL:
          if (!string_has_started) {
            if (prev_ch == CHAR_WILDCARD) {
              if (multi_comment_started)
                multi_comment_started = false;
              else {
                console.log("Error at file", filename);
                throw new Error("Broken Syntax ? */ doesn't close a comment section. at line " + (line_index+1) + " column " + col_index);
              }
            } else if (prev_ch == CHAR_RIGHT_SL) {
              single_comment_started = true;
            }
          }
          break;
        case CHAR_SPACE:
          /*do nothing*/
          break;
        case CHAR_DOUBLE_QUOTE:
        case CHAR_SINGLE_QUOTE:
          if (!single_comment_started && !multi_comment_started) {
            if (!(prev_ch == CHAR_LEFT_SL && prev_ch_repeats % 2 == 1)) {
              if (string_has_started && string_start_char == ch) {
                string_has_started = false;
                string_start_char = 0;
              } else if (!string_has_started) {
                string_has_started = true;
                string_start_char = ch;
              }
            }
          }
          break;
        default:
      }
    }
    prev_ch = ch;
    if (ch != CHAR_NEW_LINE) col_index++;

    if (ch == CHAR_OPEN_BRACKET && !string_has_started && open_pr_count == 0
        && !single_comment_started && !multi_comment_started) {
      if ( known_words[last_known_word] || new_word_since_pr_is_closed == 0 ||
        (new_word_since_pr_is_closed == 1 && last_word == 'const'))
      {
        if (last_word != '=' && last_word != ',') {
          if (LOG_MODE) {
            console.log("new_word_since_pr_is_closed", new_word_since_pr_is_closed)
            console.log("last_known_word", last_known_word)
            console.log("last_word",last_word)
          }
          new_word_since_br_is_opened = 0;
          if (last_known_word != "switch")
            injectIndexes.push({i:i, line: line_index});
        }
      }
    }
  }
}

var DICT_ = {};
var DICT_COUNT = 0;
function DICT_IT(filename, line_num) {
  if (DICT_.hasOwnProperty(filename + line_num)) return DICT_[filename + line_num];
  DICT_[filename + "@" + line_num] = DICT_COUNT++;
  return DICT_COUNT-1;
}

for(var j = 0; j < files.length; j++) {
  try {
    injectIndexes = [];
    var file_name = path.basename(files[j]);
    if (skipFile(files[j])) continue;

    var buffer = fs.readFileSync(files[j]) + "";
    Parse(files[j], buffer);

    console.log(injectIndexes.length + " injections to " + file_name)
    var inject_diff = 0;
    var string_end_index = buffer.length - 1;
    for(var i=0; i < injectIndexes.length; i++) {
      var index = injectIndexes[i].i + inject_diff;
      var inject_string = 'TRACE_IT(' + DICT_IT(file_name, injectIndexes[i].line) + ');'
      var inject_length = inject_string.length;

      buffer = buffer.substring(0, index + 1) + inject_string + buffer.substring(index + 1, string_end_index + 1);
      inject_diff += inject_length;
      string_end_index += inject_length;
    }
    if (LOG_MODE) {
      console.log(buffer)
    } else {
      fs.writeFileSync(files[j], buffer);
    }
  }
  catch(e) {
    console.log(e.message);
  }
}

var buff = [];
buff.push("var obj = {")
for(var o in DICT_) {
  if (DICT_.hasOwnProperty(o)) {
    buff.push( DICT_[o] + " : '" + o + "',");
  }
}
buff.push("};");
buff.push("console.log('RESULT ->', obj[process.argv[2]])");

fs.writeFileSync("./RESULT.js", buff.join('\n'));
