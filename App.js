Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    timeEntryItemModel: null,
    _getWeekStartDate: function(theDay) {
        var weekStartDate = theDay;
        while(weekStartDate.getUTCDay() > 0) {
            weekStartDate= Rally.util.DateTime.add(weekStartDate, 'day', -1);
        }
        return weekStartDate;
    },
            
    _loadTasksGrid: function(tasksGridDate, timeSheetData, timeEntryValueStore) {
        console.log("Loading tasks grid...");
        var prettyDate = Rally.util.DateTime.add(tasksGridDate, "minute", tasksGridDate.getTimezoneOffset());
        Rally.data.ModelFactory.getModel(
            { type: 'TimeEntryItem', scope: this, success: function(model) {
                this.timeEntryItemModel = model; 
                console.log('created model.');
                console.log(model);
            } 
        });
         Rally.data.ModelFactory.getModel({
                        type: 'Task',
                        success: function(model) {
                            this.add( {
                                xtype: 'component',
                                html: 'My Tasks for: ' +Rally.util.DateTime.format(prettyDate, "D, M d, Y")
                            });
                            var theModel = Ext.define( 'THModel', {
                                extend: model,
                                alias: 'THModel',
                                fields: [
                                    { name: "TimeSheet", type: "number", readOnly: false, persist: true } 
                                ]    
                            });
                            console.log(theModel);
                            this.grid = this.add({
                                xtype: 'rallygrid',
                                model: theModel,
                                columnCfgs: [
                                    'FormattedID', 
                                    'Name',
                                    'Owner',
                                    'State',
                                    'Project',
                                    'WorkProduct',
                                    'ToDo',
                                    { text: Rally.util.DateTime.format(prettyDate, "D M d"), tpl: '', tdCls: "editable", editor: { xtype: 'rallynumberfield', listeners: { beforestatesave: function() { console.log('foo'); }}}, dataIndex: 'TimeSheet'  }
                                    //'TimeSheet'
                                ],
                                listeners: { scope: this,
                                    beforestatesave: function() {
                                        console.log('before save...');
                                    },
                                    edit: function(editor, e, eOpts) { 
                                        if ( e.field === "TimeSheet") {
                                            var changedTask = e.record;
                                            console.log(changedTask);
                                        
                                            // Need to create a TimeEntryItem
                                            
                                            //First check for record.
                                            if (changedTask.get('TimeSheetRecord') != null ) {
                                                
                                                var tevRecord = changedTask.get('TimeSheetRecord');
                                                tevRecord.set('Hours', e.value);
                                                tevRecord.save( { scope: this, cb: function() {
                                                    // Update hours...
                                                }});
                                                return false;
                                            }
                                            
                                            this.timeEntryItemModel.find( { scope: this, filters: [
                                                    {
                                                        property: "Project",
                                                        operator: "=",
                                                        value: changedTask.get('Project')._ref
                                                    },
                                                    {
                                                        property: "Task",
                                                        operator: "=",
                                                        value: changedTask.get("_ref") 
                                                    },
                                                    {
                                                        property: "User",
                                                        operator: "=",
                                                        value:  changedTask.get('Owner')._ref
                                                    },
                                                    {
                                                        property: "WeekStartDate",
                                                        operator: "=",
                                                        value: Rally.util.DateTime.toIsoString(this._getWeekStartDate(tasksGridDate))
                                                    },
                                                    {
                                                        property: "WorkProduct",
                                                        operator: "=",
                                                        value: changedTask.get('WorkProduct')._ref 
                                                    }
                                                ],
                                                callback: function( record ) {
                                                    console.log("In CB");
                                                    var newTEI = record;
                                                    if(newTEI == null ) {
                                                        console.log('creating new TEI...');
                                                        newTEI = Ext.create(this.timeEntryItemModel, { 
                                                            Project: changedTask.get('Project')._ref, 
                                                            Task: changedTask.get("_ref"), 
                                                            User: changedTask.get('Owner')._ref, 
                                                            WeekStartDate: this._getWeekStartDate(tasksGridDate),
                                                            WorkProduct: changedTask.get('WorkProduct')._ref 
                                                        });                                            
                                                        newTEI.save({
                                                            callback: function(result, operation) {
                                                                if(operation.wasSuccessful()) {
                                                                    console.log("e.value is: "+ e.value);
                                                                    var newTEV = Ext.create(timeEntryValueStore.model, {
                                                                        TimeEntryItem: result.get('_ref'),
                                                                        Hours: e.value,
                                                                        DateVal: tasksGridDate
                                                                    });
                                                                    newTEV.save( {
                                                                        callback: function(result, op) {
                                                                            console.log('saved tev');
                                                                        }
                                                                    });
                                                                }
                                                            }
                                                        });
                                                    }  else {
                                                    
                                                        console.log("e.value is: "+ e.value);
                                                        var newTEV = Ext.create(timeEntryValueStore.model, {
                                                            TimeEntryItem: newTEI.get('_ref'),
                                                            Hours: e.value,
                                                            DateVal: tasksGridDate
                                                        });
                                                        newTEV.save( {
                                                            callback: function(result, op) {
                                                                console.log('saved tev');
                                                            }
                                                        });
                                                    }
                                                    
                                                }
                                                
                                            });
                                        }
                                    }
                                },
                                storeConfig: {
                                    filters: [
                                        {
                                            property: 'Owner',
                                            operator: '=',
                                            value: this.getContext().getUser()._ref
                                        },
                                        {
                                            property: 'Iteration.StartDate',
                                            operator: '<=',
                                            value: Rally.util.DateTime.toIsoString(tasksGridDate, false)
                                        },
                                        {
                                            property: 'Iteration.EndDate',
                                            operator: '>=',
                                            value: Rally.util.DateTime.toIsoString(tasksGridDate, false)
                                        }
                                    ],
                                    listeners: {
                                        beforesync: function() {
                                            console.log("SAVING...");
                                        },
                                        load: function(store, data, success) {
                                            //console.log(data);
                                            //debugger;
                                            Ext.each( data, function( taskRow ) {
                                                var totalHoursPerTask = 0;
                                                var foundTEV = null;
                                                Ext.each( timeSheetData, function( timeSheetRecord) {
                                                    var timeEntryItem = timeSheetRecord.get('TimeEntryItem');
                                                    //console.log(timeSheetRecord.get('DateVal') + " vs " + tasksGridDate);
                                                    if ( timeEntryItem.Task != null && Ext.Date.isEqual(timeSheetRecord.get('DateVal'), tasksGridDate)){
                                                        var teiTaskRef = new Rally.util.Ref(timeEntryItem.Task._ref);
                                                        if( teiTaskRef.getOid() === new Rally.util.Ref(taskRow.get("_ref")).getOid()) {
                                                            foundTEV = timeSheetRecord;
                                                            totalHoursPerTask += timeSheetRecord.get('Hours');
                                                        }
                                                    }
                                                });
                                                taskRow.set('TimeSheet', totalHoursPerTask);
                                                taskRow.set('TimeSheetRecord', foundTEV);
                                            });
                                        }
                                    }
                                }
                            });
                        },
                        scope: this
                    });
    },
    
    _isWeekDay: function(date) {
        return (date.getUTCDay() != 0 && date.getUTCDay() != 6);
    },
    
    _lastTenWorkDays: function(currentDate) {
      var dates = [];
      while(dates.length < 10 ){
          // NOTE: getUTCDay returns the day in GMT
          if( this._isWeekDay(currentDate)) {
            dates.unshift(currentDate);
          }
          currentDate = Rally.util.DateTime.add(currentDate, 'day', -1);
      }
      return dates;
    },
    
    titleMessage: null,
    launch: function() {
        console.log('launching....');
        var startDate = Rally.util.DateTime.fromIsoString( Rally.util.DateTime.format(new Date(), "Y-m-d\\T00:00:00.000\\Z"));
        console.log("TODAY IS: " + new Date());
        console.log("START DATE IS " + startDate);    
        var lastTenWorkDays = this._lastTenWorkDays(startDate);
        console.log(lastTenWorkDays);
        var startDate = lastTenWorkDays[0];
        Ext.create('Rally.data.WsapiDataStore', {
            model: 'TimeEntryValue',
            autoLoad: true,
            listeners: {
                load: function(store, data, success) {
                    var badDay = null;
                    var currentDayHoursCnt = 0;
                    var currentRecordIdx = 0;
                    Ext.Array.each( lastTenWorkDays, function(day) {
                        
                        var currentRecordDay = data[currentRecordIdx].get('DateVal');
                        //console.log(currentRecordDay.toUTCString() + " vs " + day.toUTCString());
                        
                        // What if they enter a time on a weekend?
                        
                        do {
                            if(data[currentRecordIdx].get('TimeEntryItem').Task != null) console.log("NOT NULL TASK!");
                            if( this._isWeekDay(currentRecordDay) ) {
                                currentDayHoursCnt += data[currentRecordIdx].get('Hours');
                            }
                            if(currentRecordIdx < (data.length-1)) {
                                currentRecordDay = data[++currentRecordIdx].get('DateVal');
                            } else {
                                break;
                            }
                        } while( Ext.Date.isEqual( currentRecordDay, day)) ;
                        
                        //console.log(day.toUTCString() + " for " + currentDayHoursCnt);
                        if(currentDayHoursCnt < 8) {
                            badDay = day;
                            return false;
                        }
                        currentDayHoursCnt = 0;
                    }, this);
                    var msgCls = "ok";
                    var htmlMessage = 'All is well.';
                    if(badDay != null) {
                        msgCls = "bad";
                        var prettyDate = Rally.util.DateTime.add(badDay, "minute", badDay.getTimezoneOffset());
                        htmlMessage = 'You only entered ' + currentDayHoursCnt + ' on ' + Rally.util.DateTime.format(prettyDate, "D, M d, Y");
                        this._loadTasksGrid(badDay, data, store);
                    }
                    console.log(htmlMessage);
                    this.titleMessage = this.add( {
                        xtype: 'component',
                        cls: "attention " + msgCls,
                        html: htmlMessage
                    });
                    this.add( {
                        xtype: 'button',
                        text: 'Click here to access your timesheet.',
                        href: '/#/timesheet'
                        
                    });
                },
                scope: this
            },
            fetch: ['Hours','DateVal', 'TimeEntryItem', 'Task'],
            filters: [
                {
                    property: 'TimeEntryItem.User',
                    operator: '=',
                    value: this.getContext().getUser()._ref
                },
                {
                    property: 'DateVal',
                    operator: '>=',
                    value: Rally.util.DateTime.toIsoString(startDate, false)
                }],
            sorters: [
                {
                    property: 'DateVal',
                    direction: 'ASC'
                }]
                
        });
        
       
    }
});
