import React, { useMemo } from 'react';

const HumanPresenceTimeline = ({ jsonData, employeeData }) => {
  const timelineData = useMemo(() => {
    // Process JSON data (existing logic)
    const processJsonData = () => {
      if (!jsonData || !Array.isArray(jsonData) || jsonData.length === 0) {
        return { segments: [], totalMinutes: 0, debug: { error: 'No JSON data' } };
      }

      const debug = { totalRecords: jsonData.length, humanDetections: 0, uniqueMinutes: 0 };
      const humanMinutes = new Set();

      jsonData.forEach((record, idx) => {
        if (record && record.timestamp && record.bounds && Array.isArray(record.bounds)) {
          const hasHuman = record.bounds.some(bound => 
            bound && bound.label && (bound.label === 'person-customer' || bound.label === 'person-employee')
          );

          if (hasHuman) {
            debug.humanDetections++;
            const date = new Date(record.timestamp);
            if (!isNaN(date.getTime())) {
              date.setSeconds(0, 0);
              humanMinutes.add(date.getTime());
            }
          }
        }
      });

      debug.uniqueMinutes = humanMinutes.size;

      if (humanMinutes.size === 0) {
        return { segments: [], totalMinutes: 0, debug };
      }

      // Create continuous segments
      const sortedMinutes = Array.from(humanMinutes).sort((a, b) => a - b);
      const segments = [];
      let currentStart = null;
      let lastMinute = null;

      sortedMinutes.forEach(minute => {
        if (currentStart === null) {
          currentStart = minute;
        } else if (minute - lastMinute > 60000) {
          segments.push({ start: currentStart, end: lastMinute + 60000 });
          currentStart = minute;
        }
        lastMinute = minute;
      });

      if (currentStart !== null && lastMinute !== null) {
        segments.push({ start: currentStart, end: lastMinute + 60000 });
      }

      return { segments, totalMinutes: humanMinutes.size, debug };
    };

    // Process Employee data (new logic)
    const processEmployeeData = () => {
      if (!employeeData || !Array.isArray(employeeData) || employeeData.length === 0) {
        return { segments: [], totalMinutes: 0, debug: { error: 'No employee data' } };
      }

      const debug = { totalRecords: employeeData.length, totalShifts: 0, employees: new Set() };
      const segments = [];
      let totalMinutes = 0;

      employeeData.forEach((record, idx) => {
        if (record && record.punchInTime && record.punchOutTime) {
          try {
            const punchIn = new Date(record.punchInTime);
            const punchOut = new Date(record.punchOutTime);
            
            if (!isNaN(punchIn.getTime()) && !isNaN(punchOut.getTime()) && punchOut > punchIn) {
              debug.totalShifts++;
              debug.employees.add(record.employeeID);
              
              const shiftMinutes = Math.round((punchOut.getTime() - punchIn.getTime()) / 60000);
              totalMinutes += shiftMinutes;

              segments.push({
                start: punchIn.getTime(),
                end: punchOut.getTime(),
                employeeID: record.employeeID,
                duration: shiftMinutes
              });
            }
          } catch (error) {
            // Skip invalid records
          }
        }
      });

      debug.totalMinutes = totalMinutes;
      debug.uniqueEmployees = debug.employees.size;

      return { segments, totalMinutes, debug };
    };

    const jsonResult = processJsonData();
    const employeeResult = processEmployeeData();

    // Calculate combined time range
    let combinedTimeRange = null;
    const allTimes = [];

    if (jsonResult.segments.length > 0) {
      allTimes.push(...jsonResult.segments.map(s => s.start));
      allTimes.push(...jsonResult.segments.map(s => s.end));
    }

    if (employeeResult.segments.length > 0) {
      allTimes.push(...employeeResult.segments.map(s => s.start));
      allTimes.push(...employeeResult.segments.map(s => s.end));
    }

    if (allTimes.length > 0) {
      const earliest = new Date(Math.min(...allTimes));
      const latest = new Date(Math.max(...allTimes));
      
      const startHour = new Date(earliest);
      startHour.setMinutes(0, 0, 0);
      const endHour = new Date(latest);
      endHour.setHours(endHour.getHours() + 1, 0, 0, 0);

      // Create hour markers
      const hourMarkers = [];
      for (let time = startHour.getTime(); time <= endHour.getTime(); time += 3600000) {
        hourMarkers.push(new Date(time));
      }

      combinedTimeRange = { start: startHour, end: endHour, hourMarkers };
    }

    return {
      json: jsonResult,
      employee: employeeResult,
      timeRange: combinedTimeRange
    };
  }, [jsonData, employeeData]);

  const { json, employee, timeRange } = timelineData;

  // Employee colors for different employees
  const employeeColors = [
    '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', 
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
  ];

  const getEmployeeColor = (employeeID) => {
    const index = Math.abs(employeeID || 0) % employeeColors.length;
    return employeeColors[index];
  };

  if (!jsonData && !employeeData) {
    return (
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '24px',
        margin: '20px 0',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{ fontSize: '24px', marginBottom: '24px', color: '#1f2937' }}>
          📈 Activity Comparison Timeline
        </h3>
        <p style={{ color: '#6b7280' }}>Upload JSON data or provide employee punch data to see timeline</p>
      </div>
    );
  }

  const timelineDuration = timeRange ? timeRange.end.getTime() - timeRange.start.getTime() : 1;

  return (
    <div style={{
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '24px',
      margin: '20px 0',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
    }}>
      <h3 style={{ 
        color: '#1f2937', 
        fontSize: '24px', 
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center'
      }}>
        📈 Activity Comparison Timeline
      </h3>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {/* JSON Summary */}
        <div style={{
          backgroundColor: '#dbeafe',
          padding: '16px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#fbbf24',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '12px',
            color: 'white',
            fontSize: '16px'
          }}>👤</div>
          <div>
            <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e3a8a', margin: '0 0 4px 0' }}>
              Human Detection (JSON)
            </h4>
            <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#3b82f6', margin: 0 }}>
              {json.totalMinutes > 0 ? `${Math.floor(json.totalMinutes / 60)}h ${json.totalMinutes % 60}m` : '0m'}
            </p>
          </div>
        </div>

        {/* Employee Summary */}
        <div style={{
          backgroundColor: '#dcfce7',
          padding: '16px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#10b981',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '12px',
            color: 'white',
            fontSize: '16px'
          }}>🏢</div>
          <div>
            <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#065f46', margin: '0 0 4px 0' }}>
              Employee Shifts (Database)
            </h4>
            <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981', margin: 0 }}>
              {employee.totalMinutes > 0 ? `${Math.floor(employee.totalMinutes / 60)}h ${employee.totalMinutes % 60}m` : '0m'}
            </p>
          </div>
        </div>
      </div>

      {/* Comparison Timeline */}
      {timeRange ? (
        <div style={{
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          backgroundColor: 'white',
          overflow: 'hidden'
        }}>
          {/* Header with time markers */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{
              width: '200px',
              padding: '12px 16px',
              backgroundColor: '#f9fafb',
              borderRight: '1px solid #e5e7eb',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151'
            }}>
              Activity Source
            </div>
            <div style={{ flex: 1, display: 'flex', position: 'relative', backgroundColor: '#f9fafb', minHeight: '40px' }}>
              {timeRange.hourMarkers.map((hour, idx) => {
                const position = ((hour.getTime() - timeRange.start.getTime()) / timelineDuration) * 100;
                return (
                  <div
                    key={idx}
                    style={{
                      position: 'absolute',
                      left: `${position}%`,
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: '12px',
                      color: '#6b7280',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {hour.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* JSON Human Detection Row */}
          <div style={{ display: 'flex', height: '50px', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{
              width: '200px',
              padding: '15px 16px',
              borderRight: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              fontSize: '14px',
              color: '#374151',
              backgroundColor: '#fef3c7'
            }}>
              👤 Human detected (JSON)
            </div>
            <div style={{ flex: 1, position: 'relative', backgroundColor: '#ffffff' }}>
              {/* Red start line */}
              <div style={{
                position: 'absolute',
                left: '0',
                top: '0',
                width: '2px',
                height: '100%',
                backgroundColor: '#ef4444',
                zIndex: 10
              }}></div>

              {/* JSON Activity segments */}
              {json.segments.map((segment, idx) => {
                const startPercent = ((segment.start - timeRange.start.getTime()) / timelineDuration) * 100;
                const durationPercent = ((segment.end - segment.start) / timelineDuration) * 100;
                
                return (
                  <div
                    key={idx}
                    style={{
                      position: 'absolute',
                      left: `${Math.max(0, startPercent)}%`,
                      top: '10px',
                      width: `${Math.max(1, durationPercent)}%`,
                      height: '30px',
                      backgroundColor: '#fbbf24',
                      border: '1px solid #f59e0b',
                      borderRadius: '4px',
                      minWidth: '8px'
                    }}
                    title={`Human activity: ${new Date(segment.start).toLocaleTimeString()} - ${new Date(segment.end).toLocaleTimeString()}`}
                  ></div>
                );
              })}

              {/* Grid lines */}
              {timeRange.hourMarkers.map((hour, idx) => {
                const position = ((hour.getTime() - timeRange.start.getTime()) / timelineDuration) * 100;
                return (
                  <div
                    key={idx}
                    style={{
                      position: 'absolute',
                      left: `${position}%`,
                      top: '0',
                      width: '1px',
                      height: '100%',
                      backgroundColor: '#e5e7eb',
                      opacity: 0.3
                    }}
                  ></div>
                );
              })}
            </div>
          </div>

          {/* Employee Database Row */}
          <div style={{ display: 'flex', height: '50px' }}>
            <div style={{
              width: '200px',
              padding: '15px 16px',
              borderRight: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              fontSize: '14px',
              color: '#374151',
              backgroundColor: '#dcfce7'
            }}>
              🏢 Employee shifts (DB)
            </div>
            <div style={{ flex: 1, position: 'relative', backgroundColor: '#ffffff' }}>
              {/* Red start line */}
              <div style={{
                position: 'absolute',
                left: '0',
                top: '0',
                width: '2px',
                height: '100%',
                backgroundColor: '#ef4444',
                zIndex: 10
              }}></div>

              {/* Employee segments */}
              {employee.segments.map((segment, idx) => {
                const startPercent = ((segment.start - timeRange.start.getTime()) / timelineDuration) * 100;
                const durationPercent = ((segment.end - segment.start) / timelineDuration) * 100;
                const color = getEmployeeColor(segment.employeeID);
                
                return (
                  <div
                    key={idx}
                    style={{
                      position: 'absolute',
                      left: `${Math.max(0, startPercent)}%`,
                      top: '10px',
                      width: `${Math.max(1, durationPercent)}%`,
                      height: '30px',
                      backgroundColor: color,
                      border: `1px solid ${color}`,
                      borderRadius: '4px',
                      minWidth: '8px',
                      opacity: 0.8
                    }}
                    title={`Employee ${segment.employeeID}: ${new Date(segment.start).toLocaleTimeString()} - ${new Date(segment.end).toLocaleTimeString()} (${Math.floor(segment.duration / 60)}h ${segment.duration % 60}m)`}
                  ></div>
                );
              })}

              {/* Grid lines */}
              {timeRange.hourMarkers.map((hour, idx) => {
                const position = ((hour.getTime() - timeRange.start.getTime()) / timelineDuration) * 100;
                return (
                  <div
                    key={idx}
                    style={{
                      position: 'absolute',
                      left: `${position}%`,
                      top: '0',
                      width: '1px',
                      height: '100%',
                      backgroundColor: '#e5e7eb',
                      opacity: 0.3
                    }}
                  ></div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          color: '#92400e'
        }}>
          <p style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 8px 0' }}>
            No Timeline Data Available
          </p>
          <p style={{ fontSize: '14px', margin: 0 }}>
            Provide JSON data and/or employee punch data to see comparison
          </p>
        </div>
      )}
    </div>
  );
};

export default HumanPresenceTimeline;