Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',


    _loadTasksGrid: function(tasksGridDate) {
         Rally.data.ModelFactory.getModel({
                        type: 'Task',
                        success: function(model) {
                            this.grid = this.add({
                                xtype: 'rallygrid',
                                model: model,
                                columnCfgs: [
                                    'FormattedID',
                                    'Name',
                                    'Owner',
                                    'State',
                                    'ToDo'
                                ],
                                
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
                                    ]
                                }
                            });
                        },
                        scope: this
                    });
    },
    
    _lastTenWorkDays: function(currentDate) {
      var dates = [];
      while(dates.length < 10 ){
          if( currentDate.getDay() != 0 && currentDate.getDay() != 6) {
            dates.unshift(currentDate);
          }
          currentDate = Rally.util.DateTime.add(currentDate, 'day', -1);
      }
      return dates;
    },
    
    launch: function() {
        console.log('launching....');
        var lastTenWorkDays = this._lastTenWorkDays(new Date());
        console.log(lastTenWorkDays);
        var startDate = lastTenWorkDays[0];
        Ext.create('Rally.data.WsapiDataStore', {
            model: 'TimeEntryValue',
            autoLoad: true,
            listeners: {
                load: function(store, data, success) {
                    console.log('in load');
                    var badDay = null;
                    //var currentDay = data[0].get('DateVal');
                    var currentDayHoursCnt = 0;
                    var currentRecordIdx = 0;
                    Ext.Array.each( lastTenWorkDays, function(day) {
                        
                        var currentRecordDay = data[currentRecordIdx].get('DateVal');
                        while( Ext.Date.isEqual( Ext.Date.clearTime(currentRecordDay), Ext.Date.clearTime(day))) {
                            currentDayHoursCnt += data[currentRecordIdx].get('Hours');

                            currentRecordDay = data[++currentRecordIdx].get('DateVal');
                        }
                        console.log(day + " for " + currentDayHoursCnt);
                        if(currentDayHoursCnt < 8) {
                            badDay = day;
                            return false;
                        }
                        currentDayHoursCnt = 0;
                    });
                    /*
                    Ext.Array.each(data, function(record) {
                        
                        //console.log(record);
                        //TODO: Fix for GMT TZ issues.
                        var recordDate = record.get('DateVal');
                        if ( Ext.Date.isEqual(recordDate,currentDay) == false ) {
                            if(currentDayHoursCnt < 8) {
                                badDay = currentDay;
                                return false;
                            } else {
                                currentDay = recordDate;
                                currentDayHoursCnt = 0;
                            }
                        } 
                        currentDayHoursCnt += record.get('Hours');
                        console.log( currentDay + " " + currentDayHoursCnt);
                    });
                    */
                    var htmlMessage = '<span class="ok">All is well.</span>';
                    if(badDay != null) {
                        htmlMessage = '<span class="bad">You only entered ' + currentDayHoursCnt + ' on ' + Rally.util.DateTime.format(badDay, "D, M d, Y") + '.</span>';
                        //this._loadTasksGrid(badDay);
                    }
                    console.log(htmlMessage);
                    this.add( {
                    });
                },
                scope: this
            },
            fetch: ['Hours','DateVal'],
            filters: [
                {
                    property: 'TimeEntryItem.User',
                    operator: '=',
                    value: this.getContext().getUser()._ref
                },
                {
                    property: 'DateVal',
                    operator: '>',
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
