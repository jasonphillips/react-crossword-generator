import React from "react";
import Morearty from "morearty";
import Immutable from "immutable";
import Generator from "./crossword-generator";
import store from "./store.min.js";
window.g = Generator;
window.store = store;

var dataCount = 841; //json items in split data
var cluesPerFile = 4; //how many to fetch per file

var nytimesClues = function(cluesCount,next) {
  var clues = []; var words = [];
  var cycles = Math.ceil(cluesCount / cluesPerFile);
  var seenFiles = {};
  for (var i=0; i < cycles; i++) {
    var dfile = Math.floor(Math.random()*(dataCount)+1);
    while (seenFiles[dfile]) {
      dfile = Math.floor(Math.random()*(dataCount)+1);
    }
    seenFiles[dfile]=true;
    $.ajax({dataType: "json", url:'data/'+dfile+'.json', success:function(data) {
      var usedItems = {};
      for (var j=0; j < cluesPerFile; j++) {
        var item = Math.floor(Math.random()*(data.length));
        while (usedItems[item]) {
          item = Math.floor(Math.random()*(data.length));
        }
        usedItems[item]=true;
        clues.push(data[item].clue);
        words.push(data[item].answer);
        if (clues.length==cluesCount) {
          next({clues:clues,words:words});
          break;
        }
      }
    }});
  }
}

var jumpClue = function(id) {
  document.getElementById('puzzle-clues').scrollTop = document.getElementById('clue-'+id).offsetTop;
}

var Ctx = Morearty.createContext({
  initialState: {
    completed: false,
    hasGrid: false,
    grid: [],
    input: null
      //words: ['taco','tuesday'],
      //clues: ['lady hamburger','for me it was _']
      //words: ["dog", "cat", "bat", "elephant", "kangaroo","abacus","zoo","monkey","people","this","instrument","staggering","wok","astonishes","mark","garfunkel","ebony"],
      //clues: ["Man's best friend", "Likes to chase mice", "Flying mammal", "Has a trunk", "Large marsupial","thing","place","guy","peeps","one","two","three","four","five","matthew","art","ivory"],
    //}
  }
});


// Idea for puzzle save / restore:
//   - stack of rand (across/down) decisions saved by generator
//   - sequence of qs from database
//   - binary sequence of filled/unfilled?
//     - hm, but incorrect letters...
// Better... use *local storage*

var Crossword = React.createClass({
  displayName: 'Crossword',
  mixins: [Morearty.Mixin],

  componentWillMount: function() {
    var binding = this.getDefaultBinding();
    this.addBindingListener(binding,function() {
      console.log('changed!');
      store.set('crossword',binding.toJS());
    });
  },

  fetchClues: function() {
    var i = this.refs.sizeInput.getDOMNode().value;
    if (!i) i = 20;
    var binding = this.getDefaultBinding();
    nytimesClues(i, function(fetched) {
      binding.atomically()
        .set('grid',null)
        .set('input',Immutable.fromJS(fetched))
        .commit();
    });
  },

  generate: function() {
    var binding = this.getDefaultBinding();
    window.m = binding;
    var cw = new Generator(
        binding.get('input.words').toArray(),
        binding.get('input.clues').toArray()
    );
    window.c = cw;
    var grid = cw.getSquareGrid(100);
    var position = 0;
    for (var i=0; i<grid.length; i++) {
      for (var j=0; j<grid[i].length; j++) {
          var cell = grid[i][j];
          if ((cell && cell.across && cell.across.is_start_of_word) ||
              (cell && cell.down && cell.down.is_start_of_word)) {
                position++;
                cell.start = true;
                cell.position = position;
          }
      }
    }
    var legend = cw.getLegend(grid);
    binding.atomically()
      .set('grid', Immutable.fromJS(grid))
      .set('hasGrid', true)
      .set('legend', legend)
      .commit();
  },

  render: function() {
    var binding = this.getDefaultBinding();
    if (!binding.get('input')) {
      //this.fetchClues();
      return <div>
          <input defaultValue="20" ref="sizeInput"/>
          <input type="button" value="Generate" onClick={this.fetchClues}></input>
        </div>;
    } else if (!binding.get('hasGrid')) {
      this.generate();
      return <div/>;
    } else {
      return <div id="crossword-grid">
        <Grid binding={binding.sub('grid')}/>
        <Legend binding={binding.sub('legend')}/>
      </div>;
    }
  }
});

var Legend = React.createClass({
  displayName: 'Legend',
  mixins: [Morearty.Mixin],
  render: function() {
    var legend = this.getDefaultBinding().toJS();
    return <div id="puzzle-clues">
      <ul><h2>Across</h2>
        {legend.across.map(function(q,i) {
          return <li key={i} id={'clue-'+q.position}><strong>{q.position} </strong>{q.clue}</li>
        })}
      </ul>
      <ul><h2>Down</h2>
        {legend.down.map(function(q,i) {
          return <li key={i} id={'clue-'+q.position}><strong>{q.position} </strong>{q.clue}</li>
        })}
      </ul>
    </div>
  }
})

var Grid = React.createClass({
  displayName: 'Grid',
  mixins: [Morearty.Mixin],
  render: function() {
    var grid = this.getDefaultBinding();//.toJS();
    return <div id="grid">
      <table id="puzzle" style={{minWidth:(grid.get().toArray().length*5.1)+'em'}}>
        <tbody>
          {grid.get().toArray().map(function(row,i) {
            return <tr key={i}>
              {row.toArray().map(function(cell,j) {
                return <Cell key={j} binding={grid.sub(i).sub(j)}/>;
              })}
            </tr>
          })}
        </tbody>
      </table>
    </div>;
  }
});

var Cell = React.createClass({
  displayName: 'Cell',
  mixins: [Morearty.Mixin],
  toCell: function(cell) {
    if (cell.position) jumpClue(cell.position);
    cell.bold = true;
    this.getDefaultBinding().set(cell);
  },
  render: function() {
    var cell = this.getDefaultBinding();
    return <td style={(cell.get() && cell.get().bold) ? {fontWeight:'bold'} : null}>
      {cell.get() ?
          <input maxLength="1" value={cell.get().char ? cell.get().char : ''}
                type="text" tabIndex="-1"
                onClick={this.toCell.bind(this,cell.get())}
          />
          : null
      }
      {(cell.get() && cell.get().start) ? <span>{cell.get().position}</span> : null}
    </td>
  }
});

var Bootstrap = Ctx.bootstrap(Crossword);

React.render(
  <Bootstrap />,
  document.getElementById('puzzle-wrapper')
);
