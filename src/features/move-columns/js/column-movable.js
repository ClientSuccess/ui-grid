(function () {
  'use strict';

  /**
   * @ngdoc overview
   * @name ui.grid.moveColumns
   * @description
   *
   * # ui.grid.moveColumns
   *
   * <div class="alert alert-warning" role="alert"><strong>Alpha</strong> This feature is in development. There will almost certainly be breaking api changes, or there are major outstanding bugs.</div>
   *
   * This module provides column moving capability to ui.grid. It enables to change the position of columns.
   * <div doc-module-components="ui.grid.moveColumns"></div>
   */
  var module = angular.module('ui.grid.moveColumns', ['ui.grid']);

  /**
   *  @ngdoc service
   *  @name ui.grid.moveColumns.service:uiGridMoveColumnService
   *  @description Service for column moving feature.
   */
  module.service('uiGridMoveColumnService', ['$q', '$timeout', '$log', 'ScrollEvent', 'uiGridConstants', 'gridUtil', function ($q, $timeout, $log, ScrollEvent, uiGridConstants, gridUtil) {

    var service = {
      initializeGrid: function (grid) {
        var self = this;
        this.registerPublicApi(grid);
        this.defaultGridOptions(grid.options);
        grid.moveColumns = {orderCache: []}; // Used to cache the order before columns are rebuilt
        grid.registerColumnBuilder(self.movableColumnBuilder);
        grid.registerDataChangeCallback(self.verifyColumnOrder, [uiGridConstants.dataChange.COLUMN]);
      },
      registerPublicApi: function (grid) {
        var self = this;
        /**
         *  @ngdoc object
         *  @name ui.grid.moveColumns.api:PublicApi
         *  @description Public Api for column moving feature.
         */
        var publicApi = {
          events: {
            /**
             * @ngdoc event
             * @name columnPositionChanged
             * @eventOf  ui.grid.moveColumns.api:PublicApi
             * @description raised when column is moved
             * <pre>
             *      gridApi.colMovable.on.columnPositionChanged(scope,function(colDef, originalPosition, newPosition){})
             * </pre>
             * @param {object} colDef the column that was moved
             * @param {integer} originalPosition of the column
             * @param {integer} finalPosition of the column
             */
            colMovable: {
              columnPositionChanged: function (colDef, originalPosition, newPosition) {
              }
            }
          },
          methods: {
            /**
             * @ngdoc method
             * @name moveColumn
             * @methodOf  ui.grid.moveColumns.api:PublicApi
             * @description Method can be used to change column position.
             * <pre>
             *      gridApi.colMovable.moveColumn(oldPosition, newPosition)
             * </pre>
             * @param {integer} originalPosition of the column
             * @param {integer} finalPosition of the column
             */
            colMovable: {
              moveColumn: function (originalPosition, finalPosition) {
                var columns = grid.columns;
                if (!angular.isNumber(originalPosition) || !angular.isNumber(finalPosition)) {
                  gridUtil.logError('MoveColumn: Please provide valid values for originalPosition and finalPosition');
                  return;
                }
                var nonMovableColumns = 0;
                for (var i = 0; i < columns.length; i++) {
                  if ((angular.isDefined(columns[i].colDef.visible) && columns[i].colDef.visible === false) || columns[i].isRowHeader === true) {
                    nonMovableColumns++;
                  }
                }
                if (originalPosition >= (columns.length - nonMovableColumns) || finalPosition >= (columns.length - nonMovableColumns)) {
                  gridUtil.logError('MoveColumn: Invalid values for originalPosition, finalPosition');
                  return;
                }
                var findPositionForRenderIndex = function (index) {
                  var position = index;
                  for (var i = 0; i <= position; i++) {
                    if (angular.isDefined(columns[i]) && ((angular.isDefined(columns[i].colDef.visible) && columns[i].colDef.visible === false) || columns[i].isRowHeader === true)) {
                      position++;
                    }
                  }
                  return position;
                };
                self.redrawColumnAtPosition(grid, findPositionForRenderIndex(originalPosition), findPositionForRenderIndex(finalPosition));
              }
            }
          }
        };
        grid.api.registerEventsFromObject(publicApi.events);
        grid.api.registerMethodsFromObject(publicApi.methods);
      },
      defaultGridOptions: function (gridOptions) {
        /**
         *  @ngdoc object
         *  @name ui.grid.moveColumns.api:GridOptions
         *
         *  @description Options for configuring the move column feature, these are available to be
         *  set using the ui-grid {@link ui.grid.class:GridOptions gridOptions}
         */
        /**
         *  @ngdoc object
         *  @name enableColumnMoving
         *  @propertyOf  ui.grid.moveColumns.api:GridOptions
         *  @description If defined, sets the default value for the colMovable flag on each individual colDefs
         *  if their individual enableColumnMoving configuration is not defined. Defaults to true.
         */
        gridOptions.enableColumnMoving = gridOptions.enableColumnMoving !== false;
      },
      movableColumnBuilder: function (colDef, col, gridOptions) {
        var promises = [];
        /**
         *  @ngdoc object
         *  @name ui.grid.moveColumns.api:ColumnDef
         *
         *  @description Column Definition for move column feature, these are available to be
         *  set using the ui-grid {@link ui.grid.class:GridOptions.columnDef gridOptions.columnDefs}
         */
        /**
         *  @ngdoc object
         *  @name enableColumnMoving
         *  @propertyOf  ui.grid.moveColumns.api:ColumnDef
         *  @description Enable column moving for the column.
         */
        colDef.enableColumnMoving = colDef.enableColumnMoving === undefined ? gridOptions.enableColumnMoving
          : colDef.enableColumnMoving;
        return $q.all(promises);
      },
      /**
       * @ngdoc method
       * @name updateColumnCache
       * @methodOf  ui.grid.moveColumns
       * @description Cache the current order of columns, so we can restore them after new columnDefs are defined
       */
      updateColumnCache: function(grid){
        grid.moveColumns.orderCache = grid.getOnlyDataColumns();
      },
      /**
       * @ngdoc method
       * @name verifyColumnOrder
       * @methodOf  ui.grid.moveColumns
       * @description dataChangeCallback which uses the cached column order to restore the column order
       * when it is reset by altering the columnDefs array.
       */
      verifyColumnOrder: function(grid){
        var headerRowOffset = grid.rowHeaderColumns.length;
        var newIndex;

        angular.forEach(grid.moveColumns.orderCache, function(cacheCol, cacheIndex){
          newIndex = grid.columns.indexOf(cacheCol);
          if ( newIndex !== -1 && newIndex - headerRowOffset !== cacheIndex ){
            var column = grid.columns.splice(newIndex, 1)[0];
            grid.columns.splice(cacheIndex + headerRowOffset, 0, column);
          }
        });
      },
      redrawColumnAtPosition: function (grid, originalPosition, newPosition) {
        var columns = grid.columns;

        if (originalPosition === newPosition) {
          return;
        }

        //check columns in between move-range to make sure they are visible columns
        var pos = (originalPosition < newPosition) ? originalPosition + 1 : originalPosition - 1;
        var i0 = Math.min(pos, newPosition);
        for (i0; i0 <= Math.max(pos, newPosition); i0++) {
          if (columns[i0].visible) {
            break;
          }
        }
        if (i0 > Math.max(pos, newPosition)) {
          //no visible column found, column did not visibly move
          return;
        }

        var originalColumn = columns[originalPosition];
        if (originalColumn.colDef.enableColumnMoving) {
          if (originalPosition > newPosition) {
            for (var i1 = originalPosition; i1 > newPosition; i1--) {
              columns[i1] = columns[i1 - 1];
            }
          }
          else if (newPosition > originalPosition) {
            for (var i2 = originalPosition; i2 < newPosition; i2++) {
              columns[i2] = columns[i2 + 1];
            }
          }
          columns[newPosition] = originalColumn;
          service.updateColumnCache(grid);
          grid.queueGridRefresh();
          $timeout(function () {
            grid.api.core.notifyDataChange( uiGridConstants.dataChange.COLUMN );
            grid.api.colMovable.raise.columnPositionChanged(originalColumn.colDef, originalPosition, newPosition);
          });
        }
      }
    };
    return service;
  }]);

  /**
   *  @ngdoc directive
   *  @name ui.grid.moveColumns.directive:uiGridMoveColumns
   *  @element div
   *  @restrict A
   *  @description Adds column moving features to the ui-grid directive.
   *  @example
   <example module="app">
   <file name="app.js">
   var app = angular.module('app', ['ui.grid', 'ui.grid.moveColumns']);
   app.controller('MainCtrl', ['$scope', function ($scope) {
        $scope.data = [
          { name: 'Bob', title: 'CEO', age: 45 },
          { name: 'Frank', title: 'Lowly Developer', age: 25 },
          { name: 'Jenny', title: 'Highly Developer', age: 35 }
        ];
        $scope.columnDefs = [
          {name: 'name'},
          {name: 'title'},
          {name: 'age'}
        ];
      }]);
   </file>
   <file name="main.css">
   .grid {
      width: 100%;
      height: 150px;
    }
   </file>
   <file name="index.html">
   <div ng-controller="MainCtrl">
   <div class="grid" ui-grid="{ data: data, columnDefs: columnDefs }" ui-grid-move-columns></div>
   </div>
   </file>
   </example>
   */
  module.directive('uiGridMoveColumns', ['uiGridMoveColumnService', function (uiGridMoveColumnService) {
    return {
      replace: true,
      priority: 0,
      require: '^uiGrid',
      scope: false,
      compile: function () {
        return {
          pre: function ($scope, $elm, $attrs, uiGridCtrl) {
            uiGridMoveColumnService.initializeGrid(uiGridCtrl.grid);
          },
          post: function ($scope, $elm, $attrs, uiGridCtrl) {
          }
        };
      }
    };
  }]);

  /**
   *  @ngdoc directive
   *  @name ui.grid.moveColumns.directive:uiGridHeaderCell
   *  @element div
   *  @restrict A
   *
   *  @description Stacks on top of ui.grid.uiGridHeaderCell to provide capability to be able to move it to reposition column.
   *
   *  On receiving mouseDown event headerCell is cloned, now as the mouse moves the cloned header cell also moved in the grid.
   *  In case the moving cloned header cell reaches the left or right extreme of grid, grid scrolling is triggered (if horizontal scroll exists).
   *  On mouseUp event column is repositioned at position where mouse is released and cloned header cell is removed.
   *
   *  Events that invoke cloning of header cell:
   *    - mousedown
   *
   *  Events that invoke movement of cloned header cell:
   *    - mousemove
   *
   *  Events that invoke repositioning of column:
   *    - mouseup
   */
  module.directive('uiGridHeaderCell', ['$q', 'gridUtil', 'uiGridMoveColumnService', '$document', '$log', 'uiGridConstants', 'ScrollEvent',
    function ($q, gridUtil, uiGridMoveColumnService, $document, $log, uiGridConstants, ScrollEvent) {
      return {
        priority: -10,
        require: '^uiGrid',
        compile: function () {
          return {
            post: function ($scope, $elm, $attrs, uiGridCtrl) {

              if ($scope.col.colDef.enableColumnMoving) {

                /*
                 * Our general approach to column move is that we listen to a touchstart or mousedown
                 * event over the column header.  When we hear one, then we wait for a move of the same type
                 * - if we are a touchstart then we listen for a touchmove, if we are a mousedown we listen for
                 * a mousemove (i.e. a drag) before we decide that there's a move underway.  If there's never a move,
                 * and we instead get a mouseup or a touchend, then we just drop out again and do nothing.
                 *
                 */
                var $contentsElm = angular.element( $elm[0].querySelectorAll('.ui-grid-cell-contents') );

                var gridLeft;
                var previousMouseX;
                var totalMouseMovement;
                var rightMoveLimit;
                var elmCloned = false;
                var movingElm;
                var reducedWidth;
                var moveOccurred = false;
                //** @izeni
                var oldMouseMovement;
                var leftMoveLimit;

                var downFn = function( event ){
                  //Setting some variables required for calculations.
                  gridLeft = $scope.grid.element[0].getBoundingClientRect().left;
                  if ( $scope.grid.hasLeftContainer() ){
                    gridLeft += $scope.grid.renderContainers.left.header[0].getBoundingClientRect().width;
                  }

                  previousMouseX = event.pageX || (event.originalEvent ? event.originalEvent.pageX : 0);
                  totalMouseMovement = 0;
                  rightMoveLimit = gridLeft + $scope.grid.getViewportWidth();

                  //** @izeni
                  oldMouseMovement = 0;
                  leftMoveLimit =  previousMouseX - gridLeft;

                  if ( event.type === 'mousedown' ){
                    $document.on('mousemove', moveFn);
                    $document.on('mouseup', upFn);
                  } else if ( event.type === 'touchstart' ){
                    $document.on('touchmove', moveFn);
                    $document.on('touchend', upFn);
                  }
                };

                var moveFn = function( event ) {
                  var pageX = event.pageX || (event.originalEvent ? event.originalEvent.pageX : 0);
                  var changeValue = pageX - previousMouseX;
                  if ( changeValue === 0 ){ return; }
                  //Disable text selection in Chrome during column move
                  document.onselectstart = function() { return false; };

                  moveOccurred = true;

                  if (!elmCloned) {
                    cloneElement();
                  }
                  else if (elmCloned) {
                    moveElement(changeValue);
                    previousMouseX = pageX;
                  }
                };

                //** @izeni
                // Remove borders: check if any have the border class and remove if they do (called in upFn below)
                var clearBorders = function() {
                  var rights = $elm[0].parentElement.querySelectorAll('.borderRightColumn'),
                    lefts = $elm[0].parentElement.querySelectorAll('.borderLeftColumn'),
                    rlength = rights.length,
                    llength = lefts.length;

                  if (rlength > 0){
                    for (var i = 0; i<rlength; i++){
                      $(rights[i]).removeClass('borderRightColumn');
                    }
                  }
                  if (llength> 0) {
                    for (var j = 0; j<llength; j++){
                      $(lefts[j]).removeClass('borderLeftColumn');
                    }
                  }
                };

                var upFn = function( event ){
                  //Re-enable text selection after column move
                  document.onselectstart = null;

                  //Remove the cloned element on mouse up.
                  if (movingElm) {
                    movingElm.remove();
                    elmCloned = false;
                  }

                  offAllEvents();
                  onDownEvents();

                  if (!moveOccurred){
                    return;
                  }

                  var columns = $scope.grid.columns;
                  var columnIndex = 0;
                  for (var i = 0; i < columns.length; i++) {
                    if (columns[i].colDef.name !== $scope.col.colDef.name) {
                      columnIndex++;
                    }
                    else {
                      break;
                    }
                  }

                  var targetIndex;

                  //Case where column should be moved to a position on its left
                  if (totalMouseMovement < 0) {
                    var totalColumnsLeftWidth = 0;
                    var il;
                    if ( $scope.grid.isRTL() ){
                      for (il = columnIndex + 1; il < columns.length; il++) {
                        if (angular.isUndefined(columns[il].colDef.visible) || columns[il].colDef.visible === true) {
                          totalColumnsLeftWidth += columns[il].drawnWidth || columns[il].width || columns[il].colDef.width;
                          if (totalColumnsLeftWidth > Math.abs(totalMouseMovement)) {
                            uiGridMoveColumnService.redrawColumnAtPosition
                            ($scope.grid, columnIndex, il - 1);
                            break;
                          }
                        }
                      }
                    }
                    else {
                      for (il = columnIndex - 1; il >= 0; il--) {
                        if (angular.isUndefined(columns[il].colDef.visible) || columns[il].colDef.visible === true) {
                          totalColumnsLeftWidth += columns[il].drawnWidth || columns[il].width || columns[il].colDef.width;
                          if (totalColumnsLeftWidth > Math.abs(totalMouseMovement)) {
                            uiGridMoveColumnService.redrawColumnAtPosition
                            ($scope.grid, columnIndex, il + 1);
                            break;
                          }
                        }
                      }
                    }

                    //Case where column should be moved to beginning (or end in RTL) of the grid.
                    if (totalColumnsLeftWidth < Math.abs(totalMouseMovement)) {
                      targetIndex = 0;
                      if ( $scope.grid.isRTL() ){
                        targetIndex = columns.length - 1;
                      }
                      uiGridMoveColumnService.redrawColumnAtPosition
                      ($scope.grid, columnIndex, targetIndex);
                    }
                  }

                  //Case where column should be moved to a position on its right
                  else if (totalMouseMovement > 0) {
                    var totalColumnsRightWidth = 0;
                    var ir;
                    if ( $scope.grid.isRTL() ){
                      for (ir = columnIndex - 1; ir > 0; ir--) {
                        if (angular.isUndefined(columns[ir].colDef.visible) || columns[ir].colDef.visible === true) {
                          totalColumnsRightWidth += columns[ir].drawnWidth || columns[ir].width || columns[ir].colDef.width;
                          if (totalColumnsRightWidth > totalMouseMovement) {
                            uiGridMoveColumnService.redrawColumnAtPosition
                            ($scope.grid, columnIndex, ir);
                            break;
                          }
                        }
                      }
                    }
                    else {
                      for (ir = columnIndex + 1; ir < columns.length; ir++) {
                        if (angular.isUndefined(columns[ir].colDef.visible) || columns[ir].colDef.visible === true) {
                          totalColumnsRightWidth += columns[ir].drawnWidth || columns[ir].width || columns[ir].colDef.width;
                          if (totalColumnsRightWidth > totalMouseMovement) {
                            uiGridMoveColumnService.redrawColumnAtPosition
                            ($scope.grid, columnIndex, ir - 1);
                            break;
                          }
                        }
                      }
                    }


                    //Case where column should be moved to end (or beginning in RTL) of the grid.
                    if (totalColumnsRightWidth < totalMouseMovement) {
                      targetIndex = columns.length - 1;
                      if ( $scope.grid.isRTL() ){
                        targetIndex = 0;
                      }
                      uiGridMoveColumnService.redrawColumnAtPosition
                      ($scope.grid, columnIndex, targetIndex);
                    }
                  }

                  //** @izeni
                  clearBorders();
                };

                var onDownEvents = function(){
                  $contentsElm.on('touchstart', downFn);
                  $contentsElm.on('mousedown', downFn);
                };

                var offAllEvents = function() {
                  $contentsElm.off('touchstart', downFn);
                  $contentsElm.off('mousedown', downFn);

                  $document.off('mousemove', moveFn);
                  $document.off('touchmove', moveFn);

                  $document.off('mouseup', upFn);
                  $document.off('touchend', upFn);
                };

                onDownEvents();


                var cloneElement = function () {
                  elmCloned = true;

                  //Cloning header cell and appending to current header cell.
                  movingElm = $elm.clone();
                  $elm.parent().append(movingElm);

                  //Left of cloned element should be aligned to original header cell.
                  movingElm.addClass('movingColumn');

                  var movingElementStyles = {};
                  movingElementStyles.left = $elm[0].offsetLeft + 'px';
                  var gridRight = $scope.grid.element[0].getBoundingClientRect().right;
                  var elmRight = $elm[0].getBoundingClientRect().right;
                  if (elmRight > gridRight) {
                    reducedWidth = $scope.col.drawnWidth + (gridRight - elmRight);
                    movingElementStyles.width = reducedWidth + 'px';
                  }
                  movingElm.css(movingElementStyles);
                };

                var moveElement = function (changeValue) {
                  //** @izeni
                  // Check to see if the mouse as moved 'out of bounds' on the active grid
                  var oob = false;
                  if (totalMouseMovement <= -leftMoveLimit && oldMouseMovement < -leftMoveLimit){
                    oob = true;
                  }

                  // Calculate total column width
                  var columns = $scope.grid.columns;
                  var totalColumnWidth = 0;
                  for (var i = 0; i < columns.length; i++) {
                    if (angular.isUndefined(columns[i].colDef.visible) || columns[i].colDef.visible === true) {
                      totalColumnWidth += columns[i].drawnWidth || columns[i].width || columns[i].colDef.width;
                    }
                  }

                  //Calculate new position of left of column
                  var currentElmLeft = movingElm[0].getBoundingClientRect().left - 1;
                  var currentElmRight = movingElm[0].getBoundingClientRect().right;
                  var newElementLeft;

                  newElementLeft = currentElmLeft - gridLeft + changeValue;
                  if (oob){
                    newElementLeft = 0;
                  }
                  newElementLeft = newElementLeft < rightMoveLimit ? newElementLeft : rightMoveLimit;

                  //Update css of moving column to adjust to new left value or fire scroll in case column has reached edge of grid
                  if ((currentElmLeft >= gridLeft || changeValue > 0) && (currentElmRight <= rightMoveLimit || changeValue < 0)) {

                    //** @izeni
                    // If the cursor is out of bounds, do not update the position of the cloned column header
                    if (oob) {
                      movingElm.css({visibility: 'visible', 'left': 0 + 'px'});
                    } else {
                      movingElm.css({visibility: 'visible', 'left': (movingElm[0].offsetLeft +
                      (newElementLeft < rightMoveLimit ? changeValue : (rightMoveLimit - currentElmLeft))) + 'px'});
                    }
                  }
                  else if (totalColumnWidth > Math.ceil(uiGridCtrl.grid.gridWidth)) {
                    changeValue *= 8;
                    var scrollEvent = new ScrollEvent($scope.col.grid, null, null, 'uiGridHeaderCell.moveElement');
                    scrollEvent.x = {pixels: changeValue};
                    scrollEvent.grid.scrollContainers('',scrollEvent);
                  }

                  //Calculate total width of columns on the left of the moving column and the mouse movement
                  var totalColumnsLeftWidth = 0;
                  for (var il = 0; il < columns.length; il++) {
                    if (angular.isUndefined(columns[il].colDef.visible) || columns[il].colDef.visible === true) {
                      if (columns[il].colDef.name !== $scope.col.colDef.name) {
                        totalColumnsLeftWidth += columns[il].drawnWidth || columns[il].width || columns[il].colDef.width;
                      }
                      else {
                        break;
                      }
                    }
                  }
                  if ($scope.newScrollLeft === undefined) {
                    totalMouseMovement += changeValue;

                    //** @izeni
                    // Keep the column header inside the grid
                    oldMouseMovement += changeValue;
                    if (oob){
                      totalMouseMovement = -leftMoveLimit;
                    } else {
                      totalMouseMovement = oldMouseMovement;
                    }

                  }
                  else {
                    totalMouseMovement = $scope.newScrollLeft + newElementLeft - totalColumnsLeftWidth;
                  }

                  //Increase width of moving column, in case the rightmost column was moved and its width was
                  //decreased because of overflow
                  if (reducedWidth < $scope.col.drawnWidth) {
                    reducedWidth += Math.abs(changeValue);
                    movingElm.css({'width': reducedWidth + 'px'});
                  }

                  //** @izeni
                  // $scope.grid.columns has all columns including client name and columns not visible on DOM

                  var allColumnsOnGrid = $scope.grid.columns;
                  // Get an array to represent visible columns on DOM
                  var visibleColumnsOnGrid = [];
                  // Get the width of each column to measure trigger events
                  var columnsWidthArray = [];
                  var colWidth = 0;

                  for (var j = 0; j < allColumnsOnGrid.length; j++) {
                    // Columns must be movable and visible
                    if (allColumnsOnGrid[j].colDef.enableColumnMoving === true && allColumnsOnGrid[j].visible === true){
                      colWidth = allColumnsOnGrid[j].drawnWidth || allColumnsOnGrid[j].width || allColumnsOnGrid[j].colDef.width;
                      columnsWidthArray.push(colWidth);
                      visibleColumnsOnGrid.push(allColumnsOnGrid[j]);
                    }
                  }

                  // Get container of all header cells on DOM
                  var parentElement = $elm[0].parentElement;

                  var indexOnDom = $elm.index();
                  var indexOnGrid = indexOnDom;

                  // currentColumnWidth
                  var currentColumnWidth = columnsWidthArray[indexOnGrid];

                  // Calculate drop zone, much of this code was reused from the 'up' function to decided where to redraw column on release
                  // Case where column should be moved to a position on its left
                  if (totalMouseMovement < 0) {
                    totalColumnsLeftWidth = 0;
                    for (var k = indexOnDom - 1; k >= 0; k--) {
                      if (angular.isUndefined(visibleColumnsOnGrid[k].colDef.visible) || visibleColumnsOnGrid[k].colDef.visible === true) {
                        totalColumnsLeftWidth += visibleColumnsOnGrid[k].drawnWidth || visibleColumnsOnGrid[k].width || visibleColumnsOnGrid[k].colDef.width;
                        if (totalColumnsLeftWidth > Math.abs(totalMouseMovement)) {
                          $($elm[0].parentElement.children[k]).removeClass('borderLeftColumn');
                          $($elm[0].parentElement.children[k + 2]).removeClass('borderLeftColumn');
                          $($elm[0].parentElement.children[k - 1]).removeClass('borderRightColumn');
                          $($elm[0].parentElement.children[k + 1]).removeClass('borderRightColumn'); // This is to remove the border when direction changes right to left
                          $($elm[0].parentElement.children[k + 1]).addClass('borderLeftColumn');
                          $($elm[0].parentElement.children[k]).addClass('borderRightColumn');
                          $($elm[0].parentElement.children[0]).removeClass('borderLeftColumn');
                          break;
                        }
                      }
                    }
                    // Case where column should be moved to beginning of the grid.
                    if (totalColumnsLeftWidth < Math.abs(totalMouseMovement)) {
                      $($elm[0].parentElement.children[1]).removeClass('borderLeftColumn');
                      $($elm[0].parentElement.children[0]).addClass('borderLeftColumn');
                      $($elm[0].parentElement.children[0]).removeClass('borderRightColumn');
                    }
                  }

                  // Case where column should be moved to a position on its right
                  else if (totalMouseMovement > 0) {
                    var totalColumnsRightWidth = 0;
                    for (var ir = indexOnDom + 1; ir < visibleColumnsOnGrid.length; ir++) {
                      if (angular.isUndefined(visibleColumnsOnGrid[ir].colDef.visible) || visibleColumnsOnGrid[ir].colDef.visible === true) {
                        totalColumnsRightWidth += visibleColumnsOnGrid[ir].drawnWidth || visibleColumnsOnGrid[ir].width || visibleColumnsOnGrid[ir].colDef.width;
                        if (totalColumnsRightWidth > totalMouseMovement) {
                          $($elm[0].parentElement.children[ir]).removeClass('borderRightColumn');
                          $($elm[0].parentElement.children[ir - 2]).removeClass('borderRightColumn');
                          $($elm[0].parentElement.children[ir + 1]).removeClass('borderLeftColumn');
                          $($elm[0].parentElement.children[ir - 1]).removeClass('borderLeftColumn');
                          $($elm[0].parentElement.children[ir - 1]).addClass('borderRightColumn');
                          $($elm[0].parentElement.children[ir]).addClass('borderLeftColumn');
                          break;
                        }
                      }
                    }
                    // Case where column should be moved to end of the grid.
                    // todo May need to do additional testing for this when scrolling works correctly
                    if (totalColumnsRightWidth < totalMouseMovement) {
                      $($elm[0].parentElement.children[visibleColumnsOnGrid - 2]).removeClass('borderLeftColumn');
                    }
                  }
                };

                $scope.$on('$destroy', offAllEvents);
              }
            }
          };
        }
      };
    }]);
})();
