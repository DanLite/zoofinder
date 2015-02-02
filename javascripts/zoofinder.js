var AnimalButton = (function () {

  var AnimalButton = function (element, index) {
    var self = this

    self.element = $(element)
    self.setSelected(false)

    self.element.click(function () {
      self.setSelected(!self.selected)
    })

    self.element.data('index', index)
  }

  AnimalButton.prototype.setSelected = function (sel) {
    if (this.selected == sel)
      return

    this.selected = sel
    this.element.toggleClass('selected', sel)
    $(this).trigger('change')
  }

  AnimalButton.prototype.setAnimal = function (animal) {
    this.animal = animal

    var imagePath = 'images/animals/' + animal.identifier + '.png'

    this.element.removeAttr('style')

    this.element.data('animal', animal.identifier)

    this.element.css('background-image', 'url(' + imagePath + ')')
    this.element.text(animal.shortName)
  }

  return AnimalButton

})()

var ZooFinder = (function () {

  var ZooFinder = function (grid) {
    var self = this

    this.grid = grid
    this.animals = []
    this.selectedAnimals = []
    this.animalButtons = []
    this.showingProbabilities = true

    $(grid).on('cell:change', _.debounce(function () {
        if (self.showingProbabilities)
          self.displayProbabilities()
        }, 10)
    )

    interact('.zoo-grid .cell').dropzone({

      ondropactivate: function (event) {
        self.grid.element.find('.cell').removeClass('droppable')
        self.grid.element.addClass('droppable')
      },
      
      ondragenter: function (event) {
        $(event.target).addClass('droppable')
      },

      ondragleave: function (event) {
        $(event.target).removeClass('droppable')
      },

      ondrop: function (event) {
        var buttonElement = $(event.relatedTarget)
        var cellElement = $(event.target)

        var button = self.animalButtons[parseInt(buttonElement.data('index'))]

        var cell = self.grid.at(
          parseInt(cellElement.data('x')),
          parseInt(cellElement.data('y'))
        )

        button.setSelected(true)

        cell.setAnimal(button.animal)
        cell.setSelected(true)
      },

      ondropdeactivate: function (event) {
        self.grid.element.removeClass('droppable')
      }

    })

    $('.animal-button').each(function (index, button) {
      var animalButton = new AnimalButton(button, index)
      self.animalButtons.push(animalButton)

      $(animalButton).on('change', function () {
        if (animalButton.selected)
          self.selectedAnimals = _.union(self.selectedAnimals, animalButton.animal)
        else
          self.selectedAnimals = _.without(self.selectedAnimals, animalButton.animal)

        if (self.showingProbabilities)
          self.displayProbabilities()
      })
    })

    interact('.animal-button').draggable({

      onstart: function (event) {
        var phantom = $('#phantom')
        var target = $(event.target)

        var x = event.pageX - target.offset().left
        var y = event.pageY - target.offset().top

        if (!phantom.length) {
          phantom = $('<div></div>').attr('id', 'phantom')
          phantom.append('<div>')
        }

        phantom.show().find('div').css('background-image', target.css('background-image'))

        phantom.css('left', event.pageX).css('top', event.pageY)

        $('body').append(phantom)

        self.grid.element.addClass('droppable')
      },

      onmove: function (event) {
        var phantom = $('#phantom')
        var target = $(event.target)
        var x = (parseFloat(target.data('x')) || 0) + event.dx
        var y = (parseFloat(target.data('y')) || 0) + event.dy

        phantom.css('transform', 'translate(' + x + 'px, ' + y + 'px)')

        target.data('x', x).data('y', y)
      },

      onend: function (event) {
        var target = $(event.target)

        target.data('x', 0).data('y', 0)

        $('#phantom').hide()
      }

    })
  }

  ZooFinder.prototype.reset = function () {
    this.selectedAnimals = []
    this.grid.reset()
    _.each(this.animalButtons, function (button) {
      button.setSelected(false)
    })
    this.grid.each(function (cell) {
      cell.resetHints()
      cell.element.text('')
    })
  }

  ZooFinder.prototype.setBiome = function (biome) {
    var self = this

    this.reset()
    this.biome = biome
    this.grid.setBiome(biome)

    this.animals = Animal.inBiome(biome)
    this.animals.push(Animal.all['discobux'])

    _.each(this.animals, function (animal, index) {
      self.animalButtons[index].setAnimal(animal)
    })
  }

  var allPossibleArrangements = function () {
    var knownAnimalTiles = {}
    var emptyTiles = []

    this.grid.each(function (cell, col, row) {
      var tiles
      if (cell.animal) {
        tiles = knownAnimalTiles[cell.animal.identifier]
        if (!tiles)
          knownAnimalTiles[cell.animal.identifier] = tiles = []

        tiles.push([col, row])
      } else if (cell.selected) {
        emptyTiles.push([col, row])
      }
    })

    return this.grid.findArrangementsForAnimals(this.selectedAnimals, knownAnimalTiles, emptyTiles)
  }

  ZooFinder.prototype.displayProbabilities = function () {
    var arrangements = allPossibleArrangements.call(this)

    if (arrangements.length == 0) {
      this.grid.each(function (cell, col, row) {
        cell.resetHints()
        cell.element.text('')
      })

      if (this.selectedAnimals.length > 0)
        alert('No possible arrangements!')

      return
    }

    // {
    //   "1,2": 3,
    //   "2,2": 9,
    //   ...
    // }
    var cellCounts = {}
    var maxCount = 0
    var minCount = Infinity

    _.each(arrangements, function (arrangement) {
      _.each(arrangement, function (animalArrangement) {
        var animal = animalArrangement['animal']
        var animalCoord = animalArrangement['coordinate']
        _.each(animal.tilesAtPosition(animalCoord[0], animalCoord[1]), function (tile) {
          var coord = tile.join(',')
          var cellCount = cellCounts[coord]
          
          if (_.isUndefined(cellCount))
            cellCount = 0
          
          cellCount += 1
          cellCounts[coord] = cellCount

          maxCount = Math.max(maxCount, cellCount)
        })
      })
    })

    var counts = _.values(cellCounts)

    minCount = _.min(counts)
    maxCount = _.max(_.without(counts, arrangements.length))

    var selectedBux = _.find(this.selectedAnimals, function (animal) {
      return animal.identifier == 'discobux'
    })

    var foundBux = _.find(_.flatten(this.grid.cellRows), function (cell) {
      return cell.animal && (cell.animal.identifier == 'discobux')
    })

    var lookingForBux = selectedBux && !foundBux

    this.grid.each(function (cell, col, row) {
      var cellIdentifier = col + ',' + row
      var cellCount = cellCounts[cellIdentifier]

      var percent = cellCount ? cellCount / arrangements.length * 100 : 0

      cell.element.text(percent.toFixed() + '%')

      cell.resetHints()

      if (cellCount == arrangements.length)
        cell.element.addClass('guaranteed-hint')
      else if (lookingForBux && cellCount == minCount)
        cell.element.addClass('bux-hint')
      else if (cellCount == maxCount)
        cell.element.addClass('best-hint')
    })
  }

  ZooFinder.prototype.arrangeAnimals = function () {
    var self = this

    var arrangements = allPossibleArrangements.call(this)

    if (arrangements.length == 0 && self.selectedAnimals.length > 0) {
      alert('No possible arrangements!')
      return
    }

    var arrangement = _.sample(arrangements)

    _.each(arrangement, function (animalArrangement) {
      var coord = animalArrangement['coordinate']
      var animal = animalArrangement['animal']
      var animalTiles = animal.tilesAtPosition(coord[0], coord[1])

      _.each(animalTiles, function (tile) {
        var cell = self.grid.at(tile[0], tile[1])
        cell.setAnimal(animal)
        cell.setSelected(true)
      })
    })
  }

  return ZooFinder

})()