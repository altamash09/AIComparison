import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, BarChart3, Database, CheckCircle, XCircle, AlertTriangle, Download, Users, Clock, Camera, RefreshCw, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import './App.css'; 

const ActivityMonitoringUtility = () => {
  const [jsonData, setJsonData] = useState([]);
  const [comparisonResults, setComparisonResults] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activities, setActivities] = useState([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Processing progress state
  const [processingProgress, setProcessingProgress] = useState({
    show: false,
    percentage: 0,
    currentStep: '',
    totalSteps: 0,
    currentStepIndex: 0,
    estimatedTimeRemaining: 0,
    startTime: null
  });

  // Pagination states - SIMPLIFIED
  const [matchesPagination, setMatchesPagination] = useState({ currentPage: 1, itemsPerPage: 10 });
  const [unmatchesPagination, setUnmatchesPagination] = useState({ currentPage: 1, itemsPerPage: 10 });

  // API Configuration - Update this URL for your environment
  const API_BASE_URL = 'http://10.144.69.61:3901/api';
  
  // For production, change the above line to:
  // const API_BASE_URL = 'https://your-domain.com/api';

  const loadActivities = useCallback(async () => {
    setIsLoadingActivities(true);
    setError(null);
    
    try {
      console.log('🔗 Attempting to fetch activities from:', `${API_BASE_URL}/activities`);
      
      const response = await fetch(`${API_BASE_URL}/activities`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', response.headers.get('content-type'));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Non-200 response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error('❌ Expected JSON but got:', contentType);
        console.error('❌ Response body:', responseText.substring(0, 200));
        throw new Error(`Expected JSON but received ${contentType || 'unknown content type'}. Check if backend is running on port 3001.`);
      }
      
      const data = await response.json();
      console.log('📊 Received data:', data);
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to load activities');
      }
      
      setActivities(data.activities || []);
      console.log(`✅ Loaded ${data.activities?.length || 0} activities from database`);
      
    } catch (error) {
      console.error('❌ Error loading activities:', error);
      
      // Provide specific error messages
      let errorMessage = 'Failed to load activities from database: ';
      
      if (error.message.includes('fetch')) {
        errorMessage += 'Cannot connect to backend server. Make sure backend is running on port 3001.';
      } else if (error.message.includes('JSON')) {
        errorMessage += 'Backend returned HTML instead of JSON. Check backend server logs for errors.';
      } else if (error.message.includes('content type')) {
        errorMessage += error.message;
      } else {
        errorMessage += error.message;
      }
      
      setError(errorMessage);
      setActivities([]);
    } finally {
      setIsLoadingActivities(false);
    }
  }, [API_BASE_URL]);

  // Load activities from database on component mount
  useEffect(() => {
    loadActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Remove loadActivities from dependency array to avoid initialization error

  const handleFileUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Reset previous state
    setError(null);
    setUploadProgress(0);
    setComparisonResults(null);
    
    // Reset pagination when new file is uploaded
    setMatchesPagination({ currentPage: 1, itemsPerPage: 10 });
    setUnmatchesPagination({ currentPage: 1, itemsPerPage: 10 });

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.json')) {
      setError('Please select a valid JSON file (.json extension required)');
      return;
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      setError(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum limit of 100MB`);
      return;
    }

    const reader = new FileReader();
    
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const progress = (e.loaded / e.total) * 100;
        setUploadProgress(Math.round(progress));
      }
    };

    reader.onload = (e) => {
      try {
        const jsonContent = e.target.result;
        let data;
        
        try {
          data = JSON.parse(jsonContent);
        } catch (parseError) {
          throw new Error(`Invalid JSON format: ${parseError.message}`);
        }
        
        // Validate JSON structure
        if (!Array.isArray(data)) {
          throw new Error('JSON file must contain an array of monitoring records');
        }

        if (data.length === 0) {
          throw new Error('JSON file contains no records');
        }

        // Validate required fields in sample records
        const sampleSize = Math.min(3, data.length);
        const requiredFields = ['company', 'store', 'date', 'camera', 'timestamp', 'image', 'bounds'];
        
        for (let i = 0; i < sampleSize; i++) {
          const record = data[i];
          const missingFields = requiredFields.filter(field => !(field in record));
          
          if (missingFields.length > 0) {
            throw new Error(`Record ${i + 1} missing required fields: ${missingFields.join(', ')}`);
          }
        }

        // Validate data consistency
        const firstRecord = data[0];
        const inconsistentRecords = data.filter(record => 
          record.company !== firstRecord.company || 
          record.store !== firstRecord.store ||
          record.date !== firstRecord.date
        );
        
        if (inconsistentRecords.length > 0) {
          console.warn(`⚠️ Found ${inconsistentRecords.length} records with different company/store/date`);
        }

        setJsonData(data);
        setUploadProgress(100);
        
        // Extract activities count from JSON
        const activitiesFound = data.reduce((count, record) => {
          if (record.bounds && Array.isArray(record.bounds)) {
            return count + record.bounds.length;
          }
          return count;
        }, 0);
        
        console.log(`📊 JSON Analysis:
          - Total records: ${data.length}
          - Activities detected: ${activitiesFound}
          - Store: ${firstRecord.store}
          - Company: ${firstRecord.company}
          - Date: ${firstRecord.date}
          - Time range: ${data[0]?.timestamp} to ${data[data.length - 1]?.timestamp}`);
        
      } catch (error) {
        console.error('❌ JSON Processing Error:', error);
        setError(`JSON file processing failed: ${error.message}`);
        setJsonData([]);
        setUploadProgress(0);
      }
    };

    reader.onerror = () => {
      setError('Failed to read the file. Please try again.');
      setUploadProgress(0);
    };

    reader.readAsText(file);
  }, []);

  const processComparison = useCallback(async () => {
    if (jsonData.length === 0) {
      setError('Please upload a JSON file first');
      return;
    }

    if (activities.length === 0) {
      setError('No activities loaded from database. Please refresh activities and try again.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    
    // Initialize progress tracking
    const steps = [
      'Preparing data structures...',
      'Extracting JSON activities...',
      'Performing focused comparison (matches vs unmatches)...',
      'Calculating detection accuracy...',
      'Generating simplified report...'
    ];
    
    setProcessingProgress({
      show: true,
      percentage: 0,
      currentStep: steps[0],
      totalSteps: steps.length,
      currentStepIndex: 0,
      estimatedTimeRemaining: 0,
      startTime: Date.now()
    });

    try {
      console.log('🔄 Starting comparison process...');
      
      // Step 1: Prepare data
      await updateProgress(0, steps[0], steps.length);
      
      // Prepare form data for backend
      const formData = new FormData();
      const jsonBlob = new Blob([JSON.stringify(jsonData)], { type: 'application/json' });
      formData.append('jsonFile', jsonBlob, `monitoring-data-${Date.now()}.json`);
      
      // Add metadata
      const firstRecord = jsonData[0];
      formData.append('storeId', firstRecord.store?.toString() || '');
      formData.append('companyId', firstRecord.company?.toString() || '');
      formData.append('monitoringDate', firstRecord.date || '');

      console.log(`📤 Sending data to backend:
        - Store ID: ${firstRecord.store}
        - Company ID: ${firstRecord.company}
        - Date: ${firstRecord.date}
        - Records: ${jsonData.length}`);

      // Step 2: Upload starting
      await updateProgress(1, steps[1], steps.length);

      // Check if backend supports progress tracking
      const supportsProgress = false; // Using simulated progress to show individual activities immediately
      
      if (supportsProgress) {
        // Method 1: Backend with progress support
        await processWithBackendProgress(formData, steps);
      } else {
        // Method 2: Simulated progress
        await processWithSimulatedProgress(formData, steps);
      }
      
    } catch (error) {
      console.error('❌ Comparison Error:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Processing failed: ';
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage += 'Unable to connect to server. Please check if the backend is running.';
      } else if (error.message.includes('404')) {
        errorMessage += 'API endpoint not found. Please check your server configuration.';
      } else if (error.message.includes('500')) {
        errorMessage += 'Server internal error. Please check server logs.';
      } else {
        errorMessage += error.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
      setProcessingProgress(prev => ({ ...prev, show: false }));
    }
  }, [jsonData, activities, API_BASE_URL]);

  // Helper function to update progress
  const updateProgress = useCallback(async (stepIndex, stepName, totalSteps) => {
    const percentage = Math.round((stepIndex / totalSteps) * 100);
    const startTime = processingProgress.startTime || Date.now();
    const elapsed = Date.now() - startTime;
    const estimatedTotal = elapsed / (stepIndex + 1) * totalSteps;
    const remaining = Math.max(0, Math.round((estimatedTotal - elapsed) / 1000));
    
    setProcessingProgress(prev => ({
      ...prev,
      percentage,
      currentStep: stepName,
      currentStepIndex: stepIndex,
      estimatedTimeRemaining: remaining,
      startTime: prev.startTime || Date.now()
    }));
    
    // Small delay to show progress visually
    await new Promise(resolve => setTimeout(resolve, 500));
  }, [processingProgress.startTime]);

  // Method 1: Process with backend progress support (if your backend supports it)
  const processWithBackendProgress = useCallback(async (formData, steps) => {
    // Generate unique process ID
    const processId = `comparison_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    formData.append('processId', processId);
    
    console.log(`🚀 Starting backend comparison with process ID: ${processId}`);
    
    // Start the processing (non-blocking)
    const processPromise = fetch(`${API_BASE_URL}/monitoring/compare`, {
      method: 'POST',
      body: formData,
    }).then(response => response.json());
    
    // Poll for progress every 500ms
    const progressPolling = setInterval(async () => {
      try {
        const progressResponse = await fetch(`${API_BASE_URL}/monitoring/progress/${processId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (progressResponse.ok) {
          const progressData = await progressResponse.json();
          
          if (progressData.success && progressData.progress) {
            const progress = progressData.progress;
            
            // Calculate estimated time remaining
            const elapsed = Date.now() - (processingProgress.startTime || Date.now());
            const estimatedTotal = progress.percentage > 0 ? (elapsed / progress.percentage) * 100 : 0;
            const remaining = Math.max(0, Math.round((estimatedTotal - elapsed) / 1000));
            
            setProcessingProgress(prev => ({
              ...prev,
              percentage: progress.percentage || prev.percentage,
              currentStep: progress.currentStep || prev.currentStep,
              currentStepIndex: progress.stepIndex || prev.currentStepIndex,
              estimatedTimeRemaining: remaining
            }));
            
            console.log(`📊 Real Progress Update: ${progress.percentage}% - ${progress.currentStep}`);
          }
        } else {
          console.log('📡 Progress endpoint not available, backend may not support progress tracking');
        }
      } catch (progressError) {
        console.log('📡 Progress polling failed:', progressError.message);
      }
    }, 300); // Poll every 300ms for faster updates
    
    try {
      // Wait for the actual processing to complete
      const responseData = await processPromise;
      clearInterval(progressPolling);
      
      if (!responseData.success) {
        throw new Error(responseData.message || 'Comparison processing failed');
      }

      console.log('✅ Comparison completed successfully:', responseData.data);
      setComparisonResults(responseData.data);
    
    // Reset pagination when new results are loaded
    setMatchesPagination({ currentPage: 1, itemsPerPage: 10 });
    setUnmatchesPagination({ currentPage: 1, itemsPerPage: 10 });
      
      // Reset pagination when new results are loaded
      setMatchesPagination({ currentPage: 1, itemsPerPage: 10 });
      setUnmatchesPagination({ currentPage: 1, itemsPerPage: 10 });
      
      // Show completion
      setProcessingProgress(prev => ({
        ...prev,
        percentage: 100,
        currentStep: 'Comparison completed successfully!',
        currentStepIndex: steps.length - 1,
        estimatedTimeRemaining: 0
      }));
      
      // Keep the success message visible for 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      clearInterval(progressPolling);
      throw error;
    }
  }, [API_BASE_URL, processingProgress.startTime]);

  // Method 2: Optimized simulated progress for ultra-fast processing
  const processWithSimulatedProgress = useCallback(async (formData, steps) => {
    // Calculate total activities to process
    const totalJsonRecords = jsonData.length;
    const totalDbActivities = activities.length;
    
    // Extract activities from JSON data for realistic progress
    const jsonActivities = [];
    jsonData.forEach(record => {
      if (record.bounds && Array.isArray(record.bounds)) {
        record.bounds.forEach(bound => {
          if (bound.label) {
            jsonActivities.push({
              name: bound.label === 'person-employee' ? 'Employee Activity' : 
                    bound.label === 'person-customer' ? 'Customer Activity' : bound.label,
              timestamp: record.timestamp,
              camera: record.camera
            });
          }
        });
      }
    });

    const totalActivitiesToProcess = jsonActivities.length;
    console.log(`⚡ Processing: ${totalActivitiesToProcess} activities from ${totalJsonRecords} records`);

    // Start the actual backend request (this should be FAST now)
    const backendPromise = fetch(`${API_BASE_URL}/monitoring/compare`, {
      method: 'POST',
      body: formData,
    }).then(response => response.json());

    // ULTRA-FAST progress simulation (no artificial delays)
    const activityNames = ['Sales Desk', 'Stretching', 'Cleaning', 'Making Calls', 'Intake', 'Customer Service', 'Stock Check', 'Register Operation'];
    
    // Step 1: Data preparation (instant)
    setProcessingProgress(prev => ({
      ...prev,
      percentage: 10,
      currentStep: `Preparing data structures for ${totalActivitiesToProcess} activities...`,
      currentStepIndex: 0,
      estimatedTimeRemaining: 2
    }));

    // Small delay to show the step
    await new Promise(resolve => setTimeout(resolve, 100));

    // Step 2: Ultra-fast JSON processing
    setProcessingProgress(prev => ({
      ...prev,
      percentage: 30,
      currentStep: `Extraction from ${totalJsonRecords} JSON records...`,
      currentStepIndex: 1,
      estimatedTimeRemaining: 1
    }));

    await new Promise(resolve => setTimeout(resolve, 200));

    // Step 3: Ultra-fast comparison (this is where the real magic happens)
    let currentActivity = 0;
    const batchSize = Math.max(1, Math.floor(totalActivitiesToProcess / 20)); // Process in batches for smooth UI

    for (let batch = 0; batch < Math.min(20, totalActivitiesToProcess); batch++) {
      currentActivity += batchSize;
      const percentage = 30 + Math.round((batch / 20) * 50); // 30% to 80%
      const activityName = activityNames[Math.floor(Math.random() * activityNames.length)];
      
      setProcessingProgress(prev => ({
        ...prev,
        percentage,
        currentStep:       `Focused comparison: ${totalActivitiesToProcess} activities vs database...`,
        currentStepIndex: 2,
        estimatedTimeRemaining: Math.max(0, 1 - (batch / 20))
      }));
      
      // NO ARTIFICIAL DELAYS - just quick UI updates
      await new Promise(resolve => setTimeout(resolve, 25)); // Minimal delay for smooth UI
    }

    // Step 4: Finalizing
    setProcessingProgress(prev => ({
      ...prev,
      percentage: 90,
      currentStep: 'Generating results and accuracy metrics...',
      currentStepIndex: 3,
      estimatedTimeRemaining: 0
    }));

    console.log(`⚡ Waiting for backend processing...`);

    // Wait for actual backend processing (should be FAST now)
    let responseData;
    try {
      responseData = await backendPromise;
    } catch (jsonError) {
      throw new Error(`Invalid response from server: ${jsonError.message}`);
    }

    if (!responseData.success) {
      throw new Error(responseData.message || 'Comparison processing failed');
    }

    console.log('⚡ Comparison completed:', responseData.data);
    
    // DEBUG: Log the actual structure we received
    console.log('🔍 DEBUG - Response structure:', {
      success: responseData.success,
      dataKeys: Object.keys(responseData.data || {}),
      rawData: responseData.data
    });
    
    // Log performance metrics if available
    if (responseData.data.performanceMetrics) {
      const metrics = responseData.data.performanceMetrics;
      console.log(`📊 PERFORMANCE METRICS:
        - Total time: ${metrics.totalProcessingTimeMs}ms
        - Activities/sec: ${metrics.activitiesProcessedPerSecond?.toLocaleString()}`);
    }
    
    setComparisonResults(responseData.data);
    
    // Reset pagination when new results are loaded
    setMatchesPagination({ currentPage: 1, itemsPerPage: 10 });
    setUnmatchesPagination({ currentPage: 1, itemsPerPage: 10 });
    
    // Complete progress
    setProcessingProgress(prev => ({
      ...prev,
      percentage: 100,
      currentStep: `⚡ FOCUSED Complete! ${responseData.data.matchedCount || responseData.data.matches?.length || 0} accurate detections, ${responseData.data.unmatchedCount || responseData.data.unmatches?.length || 0} missed by AI (${responseData.data.accuracyPercentage || 0}% accuracy)`,
      currentStepIndex: 4,
      estimatedTimeRemaining: 0
    }));
    
    console.log(`⚡ Processing completed!`);
    
    // Keep success message visible for 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, [API_BASE_URL, jsonData, activities]);

  const downloadReport = useCallback(() => {
    if (!comparisonResults) {
      setError('No comparison results available for download');
      return;
    }

    try {
      const reportData = {
        metadata: {
          generatedAt: new Date().toISOString(),
          storeId: jsonData[0]?.store,
          companyId: jsonData[0]?.company,
          monitoringDate: jsonData[0]?.date,
          totalRecordsProcessed: jsonData.length,
          systemVersion: '1.0.0'
        },
        summary: {
          overallAccuracy: comparisonResults.overallAccuracy,
          totalMatches: comparisonResults.totalMatches,
          totalJsonActivities: comparisonResults.totalJsonActivities,
          totalDbActivities: comparisonResults.totalDbActivities,
          jsonMissedCount: comparisonResults.jsonMissed?.length || 0,
          dbMissedCount: comparisonResults.dbMissed?.length || 0,
          processingTime: comparisonResults.processingTime
        },
        results: {
          matches: comparisonResults.matches || [],
          jsonMissed: comparisonResults.jsonMissed || [],
          dbMissed: comparisonResults.dbMissed || []
        },
        activityAccuracy: comparisonResults.activityAccuracy || {}
      };

      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `activity-comparison-report-store${jsonData[0]?.store}-${timestamp}.json`;
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`📥 Report downloaded: ${filename}`);
      
    } catch (error) {
      console.error('❌ Download Error:', error);
      setError(`Failed to download report: ${error.message}`);
    }
  }, [comparisonResults, jsonData]);

  const retryOperation = useCallback(() => {
    setError(null);
    if (activities.length === 0) {
      loadActivities();
    }
  }, [activities.length, loadActivities]);

  // Pagination helper functions
  const getPaginatedData = useCallback((data, currentPage, itemsPerPage) => {
    if (!data || !Array.isArray(data)) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  }, []);

  const getTotalPages = useCallback((dataLength, itemsPerPage) => {
    return Math.ceil(dataLength / itemsPerPage);
  }, []);

  // Pagination component
  const PaginationControls = ({ currentPage, totalItems, itemsPerPage, onPageChange, onItemsPerPageChange, label }) => {
    const totalPages = getTotalPages(totalItems, itemsPerPage);
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    if (totalItems === 0) return null;

    return (
      <div className="flex items-center justify-between mt-6 px-4 py-3 bg-white border-t border-gray-200">
        {/* Left side - Results info */}
        <div className="flex items-center space-x-4">
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{startItem}</span> to <span className="font-medium">{endItem}</span> of{' '}
            <span className="font-medium">{totalItems}</span> {label}
          </p>
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(parseInt(e.target.value))}
            className="text-sm border-gray-300 rounded-md"
          >
            <option value={5}>5 per page</option>
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
        </div>

        {/* Right side - Navigation */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Page numbers */}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(page => {
              if (totalPages <= 7) return true;
              if (page === 1 || page === totalPages) return true;
              if (page >= currentPage - 1 && page <= currentPage + 1) return true;
              return false;
            })
            .map((page, index, array) => {
              const showEllipsis = index > 0 && page - array[index - 1] > 1;
              
              return (
                <React.Fragment key={page}>
                  {showEllipsis && (
                    <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                      ...
                    </span>
                  )}
                  <button
                    onClick={() => onPageChange(page)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      page === currentPage
                        ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                </React.Fragment>
              );
            })}

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  };

  // Chart data preparation - SIMPLIFIED
  const chartData = comparisonResults ? [
    { name: 'Accurate Detections', value: comparisonResults.matchedCount || comparisonResults.matches?.length || 0, color: '#10B981' },
    { name: 'Missed by AI', value: comparisonResults.unmatchedCount || comparisonResults.unmatches?.length || 0, color: '#EF4444' }
  ] : [];

  const activityAccuracyData = comparisonResults?.matches ? 
    // Group matches by activity type for accuracy chart
    Object.entries(
      comparisonResults.matches.reduce((acc, match) => {
        acc[match.activityName] = (acc[match.activityName] || 0) + 1;
        return acc;
      }, {})
    ).map(([name, count]) => ({
      name: name.length > 15 ? name.substring(0, 15) + '...' : name,
      fullName: name,
      count: count
    })) : [];

  const formatConfidence = (confidence) => {
    if (typeof confidence !== 'number') return { percentage: '0.0', level: 'low' };
    const percentage = (confidence * 100).toFixed(1);
    const level = confidence > 0.8 ? 'high' : confidence > 0.5 ? 'medium' : 'low';
    return { percentage, level };
  };

  const formatTimestamp = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Activity Monitoring Comparison</h1>
              <p className="text-lg text-gray-600">Compare JSON detection data with database monitoring activities</p>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
                <Database className="w-4 h-4" />
                <span>Production System</span>
              </div>
              {activities.length > 0 && (
                <div className="text-xs text-green-600">
                  ✅ {activities.length} activities loaded from database
                </div>
              )}
              {isLoadingActivities && (
                <div className="text-xs text-blue-600">
                  🔄 Loading activities...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-red-800 font-medium">Error</p>
                <p className="text-red-700 text-sm whitespace-pre-wrap">{error}</p>
              </div>
              <button
                onClick={retryOperation}
                className="ml-3 flex items-center px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Retry
              </button>
            </div>
          </div>
        )}

        {/* System Status */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-8">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div className={`flex items-center ${activities.length > 0 ? 'text-green-600' : 'text-red-600'}`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${activities.length > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                Database: {activities.length > 0 ? 'Connected' : 'Disconnected'}
              </div>
              <div className="flex items-center text-blue-600">
                <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                Production
              </div>
            </div>
            <div className="text-gray-500">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="grid grid-cols-1 gap-8 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center justify-center">
              <Upload className="w-6 h-6 mr-2 text-blue-600" />
              Upload JSON File for Analysis
            </h2>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={isProcessing || isLoadingActivities}
              />
              <label htmlFor="file-upload" className={`cursor-pointer ${(isProcessing || isLoadingActivities) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-xl font-medium text-gray-900 mb-2">Choose JSON file</p>
                <p className="text-sm text-gray-500">Upload your activity monitoring JSON file</p>
                <p className="text-xs text-gray-400 mt-2">Max file size: 100MB • Automatic email reports</p>
              </label>
            </div>

            {/* Upload Progress */}
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-4">
                <div className="bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mt-1 text-center">Uploading... {uploadProgress}%</p>
              </div>
            )}
            
            {/* File Upload Success */}
            {jsonData.length > 0 && (
              <div className="mt-6 p-4 bg-green-50 rounded-lg">
                <div className="flex items-center mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                  <p className="text-green-800 font-medium">✓ Successfully loaded {jsonData.length} records</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-green-700">
                  <div>Store: {jsonData[0]?.store}</div>
                  <div>Company: {jsonData[0]?.company}</div>
                  <div>Date: {jsonData[0]?.date}</div>
                </div>
                <div className="text-xs text-green-600 mt-1">
                  Time range: {jsonData[0]?.timestamp} → {jsonData[jsonData.length - 1]?.timestamp}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Processing Progress Modal */}
        {processingProgress.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full mx-4">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Focused AI Detection Analysis</h3>
                <p className="text-sm text-gray-600 mb-6 min-h-[2.5rem] flex items-center justify-center">
                  {processingProgress.currentStep}
                </p>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-4 mb-4 relative overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full transition-all duration-300 ease-out relative"
                    style={{ width: `${processingProgress.percentage}%` }}
                  >
                    <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                    {processingProgress.percentage}%
                  </div>
                </div>
                
                {/* Progress Info */}
                <div className="flex justify-between text-sm text-gray-500 mb-4">
                  <span>{processingProgress.percentage}% Complete</span>
                  <span>
                    Step {processingProgress.currentStepIndex + 1} of {processingProgress.totalSteps}
                  </span>
                </div>
                
                {/* Estimated Time */}
                {processingProgress.estimatedTimeRemaining > 0 && (
                  <div className="mb-4 text-xs text-gray-400">
                    Estimated time remaining: {processingProgress.estimatedTimeRemaining}s
                  </div>
                )}
                
                {/* Activity Stats */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">JSON Records:</span>
                      <div className="font-semibold text-blue-600">{jsonData.length.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">DB Activities:</span>
                      <div className="font-semibold text-green-600">{activities.length.toLocaleString()}</div>
                    </div>
                  </div>
                  
                  {/* Live activity processing indicator */}
                  {processingProgress.currentStep.includes('Comparing activity') && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-center text-xs text-gray-500">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-2"></div>
                        Processing activities in real-time...
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Cancel button (optional) */}
                <button
                  onClick={() => {
                    setProcessingProgress(prev => ({ ...prev, show: false }));
                    setIsProcessing(false);
                  }}
                  className="mt-4 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Hide Progress (processing continues)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={processComparison}
              disabled={isProcessing || jsonData.length === 0 || activities.length === 0 || isLoadingActivities}
              className="flex items-center px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-lg font-semibold"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-6 h-6 mr-3 animate-spin" />
                  Processing & Sending Report...
                </>
              ) : (
                <>
                  <BarChart3 className="w-6 h-6 mr-3" />
                  Process Comparison & Send Report
                </>
              )}
            </button>
            
            <button
              onClick={downloadReport}
              disabled={!comparisonResults}
              className="flex items-center px-6 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-5 h-5 mr-2" />
              Download Detailed Report
            </button>

            <button
              onClick={loadActivities}
              disabled={isLoadingActivities}
              className="flex items-center px-6 py-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoadingActivities ? (
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5 mr-2" />
              )}
              Refresh Activities
            </button>
          </div>
          
          {comparisonResults && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg text-center">
              <p className="text-green-800 text-sm font-medium">
                ✅ Analysis complete! Report automatically sent via email.
              </p>
              <div className="text-green-600 text-xs mt-1 space-x-4">
                <span>Database Activities: {comparisonResults.totalDbActivities || 0}</span>
                <span>Accurate Detections: {comparisonResults.matchedCount || comparisonResults.matches?.length || 0}</span>
                <span>Missed by AI: {comparisonResults.unmatchedCount || comparisonResults.unmatches?.length || 0}</span>
                <span>Accuracy: {comparisonResults.accuracyPercentage || 0}%</span>
              </div>
              {/* DEBUG INFO */}
              {/* <div className="text-xs text-gray-500 mt-2">
                DEBUG: Available keys: {Object.keys(comparisonResults).join(', ')}
              </div> */}
            </div>
          )}
        </div>

        {/* Results Dashboard */}
        {comparisonResults && (
          <>
            {/* Summary Cards - SIMPLIFIED */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm">Detection Accuracy</p>
                    <p className="text-3xl font-bold">{comparisonResults.accuracyPercentage || 0}%</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-200" />
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm">Accurate Detections</p>
                    <p className="text-3xl font-bold">{comparisonResults.matchedCount || comparisonResults.matches?.length || 0}</p>
                  </div>
                  <Users className="w-8 h-8 text-blue-200" />
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-100 text-sm">Missed by AI</p>
                    <p className="text-3xl font-bold">{comparisonResults.unmatchedCount || comparisonResults.unmatches?.length || 0}</p>
                  </div>
                  <XCircle className="w-8 h-8 text-red-200" />
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm">Database Activities</p>
                    <p className="text-3xl font-bold">{comparisonResults.totalDbActivities || 0}</p>
                  </div>
                  <Database className="w-8 h-8 text-purple-200" />
                </div>
              </div>
            </div>

            {/* Charts - SIMPLIFIED */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Detection Overview */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">AI Detection Performance</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({name, value}) => `${name}: ${value}`}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Activity Detection Count */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Detections by Activity Type</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={activityAccuracyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => [value, 'Detections']}
                      labelFormatter={(label, payload) => {
                        const item = payload?.[0]?.payload;
                        return item?.fullName || label;
                      }}
                    />
                    <Bar dataKey="count" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Detailed Results Tables - SIMPLIFIED */}
            <div className="space-y-8">
              {/* Accurate Detections (Matches) */}
              {comparisonResults.matches && comparisonResults.matches.length > 0 && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <CheckCircle className="w-6 h-6 mr-2 text-green-600" />
                    ✅ Accurate Detections - Found in Both Systems ({comparisonResults.matches.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full table-auto">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activity</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Camera</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zone</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {getPaginatedData(comparisonResults.matches, matchesPagination.currentPage, matchesPagination.itemsPerPage).map((match, index) => {
                          const confidence = formatConfidence(match.confidence);
                          return (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div className="flex items-center">
                                  <Clock className="w-4 h-4 mr-2 text-gray-400" />
                                  {formatTimestamp(match.timestamp)}
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{match.activityName}</td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div className="flex items-center">
                                  <Camera className="w-4 h-4 mr-2 text-gray-400" />
                                  {match.camera}
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{match.zone || 'N/A'}</td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  confidence.level === 'high' ? 'bg-green-100 text-green-800' :
                                  confidence.level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {confidence.percentage}%
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  ✅ Accurate
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <PaginationControls
                    currentPage={matchesPagination.currentPage}
                    totalItems={comparisonResults.matches.length}
                    itemsPerPage={matchesPagination.itemsPerPage}
                    onPageChange={(page) => setMatchesPagination(prev => ({ ...prev, currentPage: page }))}
                    onItemsPerPageChange={(items) => setMatchesPagination({ currentPage: 1, itemsPerPage: items })}
                    label="accurate detections"
                  />
                </div>
              )}

              {/* Missed by AI (Unmatches) */}
              {comparisonResults.unmatches && comparisonResults.unmatches.length > 0 && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <XCircle className="w-6 h-6 mr-2 text-red-600" />
                    ❌ False AI Detections by AI - In Database Only ({comparisonResults.unmatches.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full table-auto">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activity</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Camera</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {getPaginatedData(comparisonResults.unmatches, unmatchesPagination.currentPage, unmatchesPagination.itemsPerPage).map((unmatch, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-2 text-gray-400" />
                                {formatTimestamp(unmatch.timestamp)}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{unmatch.activityName}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div className="flex items-center">
                                <Camera className="w-4 h-4 mr-2 text-gray-400" />
                                {unmatch.camera}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                AI Detected
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <PaginationControls
                    currentPage={unmatchesPagination.currentPage}
                    totalItems={comparisonResults.unmatches.length}
                    itemsPerPage={unmatchesPagination.itemsPerPage}
                    onPageChange={(page) => setUnmatchesPagination(prev => ({ ...prev, currentPage: page }))}
                    onItemsPerPageChange={(items) => setUnmatchesPagination({ currentPage: 1, itemsPerPage: items })}
                    label="missed activities"
                  />
                </div>
              )}

            {/* Raw Data Verification - Collapsible */}
            <div className="space-y-4">
              {/* No Results Message */}
              {comparisonResults && 
               (!comparisonResults.matches || comparisonResults.matches.length === 0) &&
               (!comparisonResults.unmatches || comparisonResults.unmatches.length === 0) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center mb-6">
                  <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-yellow-800 mb-2">No Activity Data Found</h3>
                  <p className="text-yellow-700">
                    No activities were found for comparison. Please check that your JSON file contains activity bounds and that the database has monitoring data for this date.
                  </p>
                </div>
              )}

              {/* Raw JSON Activities */}
              <details className="bg-white rounded-xl shadow-lg">
                <summary className="p-6 cursor-pointer hover:bg-gray-50 font-semibold text-gray-900 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-blue-600" />
                  📄 Raw JSON Activities Data ({jsonData.reduce((count, record) => count + (record.bounds?.length || 0), 0)} total bounds)
                  <span className="ml-auto text-sm text-gray-500">Click to expand/collapse</span>
                </summary>
                <div className="px-6 pb-6 border-t border-gray-200">
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Extracted Activities from JSON:</h4>
                    <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                        {jsonData.length > 0 ? JSON.stringify(
                          jsonData.map(record => ({
                            timestamp: record.timestamp,
                            camera: record.camera,
                            image: record.image,
                            bounds: record.bounds?.map(bound => ({
                              label: bound.label,
                              confidence: bound.confidence,
                              zone: bound.zone,
                              mappedToActivityIds: bound.label === 'person-employee' ? [1,2,3,4] : 
                                                 bound.label === 'person-customer' ? [5] : []
                            })) || []
                          })).slice(0, 10),
                          null, 2
                        ) + (jsonData.length > 10 ? `\n... and ${jsonData.length - 10} more records` : '') : 'No JSON data loaded'}
                      </pre>
                    </div>
                  </div>
                </div>
              </details>

              {/* Raw Database Activities */}
              <details className="bg-white rounded-xl shadow-lg">
                <summary className="p-6 cursor-pointer hover:bg-gray-50 font-semibold text-gray-900 flex items-center">
                  <Database className="w-5 h-5 mr-2 text-green-600" />
                  🗄️ Raw Database Monitoring Activities ({activities.length} activity types loaded)
                  <span className="ml-auto text-sm text-gray-500">Click to expand/collapse</span>
                </summary>
                <div className="px-6 pb-6 border-t border-gray-200">
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Available Activity Types:</h4>
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <pre className="text-xs text-gray-700">
                        {JSON.stringify(activities.map(activity => ({
                          ActivityID: activity.ActivityID,
                          ActivityName: activity.ActivityName
                        })), null, 2)}
                      </pre>
                    </div>
                    
                    <h4 className="font-medium text-gray-900 mb-2">Sample Database Monitoring Records:</h4>
                    <div className="text-sm text-gray-600 mb-2">
                      (Note: This shows the structure - actual data loaded from your database)
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                        {`Expected Database Structure:
[
  {
    "MonitoringActivityID": 1,
    "ActivityID": 1,
    "ActivityName": "Sales Desk",
    "Timestamp": "2024-01-15T10:30:00Z",
    "CameraNo": "Camera_1"
  },
  {
    "MonitoringActivityID": 2,
    "ActivityID": 2,
    "ActivityName": "Cleaning",
    "Timestamp": "2024-01-15T11:15:00Z", 
    "CameraNo": "Camera_2"
  }
  // ... more records
]`}
                      </pre>
                    </div>
                  </div>
                </div>
              </details>

              {/* Comparison Logic Explanation */}
              <details className="bg-white rounded-xl shadow-lg">
                <summary className="p-6 cursor-pointer hover:bg-gray-50 font-semibold text-gray-900 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2 text-yellow-600" />
                  🔍 Comparison Logic & Matching Rules
                  <span className="ml-auto text-sm text-gray-500">Click to expand/collapse</span>
                </summary>
                <div className="px-6 pb-6 border-t border-gray-200">
                  <div className="mt-4 space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Activity Mapping Rules:</h4>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="text-sm text-blue-800">
                          <div>JSON Label → Database Activity IDs</div>
                          <div>├── "person-employee" → [1, 2, 3, 4] (Sales Desk, Stretching, Cleaning, Making Calls)</div>
                          <div>└── "person-customer" → [5] (Intake)</div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Matching Criteria:</h4>
                      <div className="bg-green-50 rounded-lg p-4">
                        <div className="text-sm text-green-800">
                          <p className="font-medium mb-2">✅ MATCH Found When:</p>
                          <ul className="list-disc list-inside space-y-1">
                            <li><strong>Timestamp:</strong> JSON timestamp = Database timestamp (normalized to ISO format)</li>
                            <li><strong>Activity ID:</strong> Mapped JSON label activity ID = Database ActivityID</li>
                            <li><strong>Camera:</strong> JSON camera = Database CameraNo</li>
                          </ul>
                          <p className="mt-3 text-xs">
                            Example Match: JSON("2024-01-15T10:30:00Z", 1, "Camera_1") = DB("2024-01-15T10:30:00Z", 1, "Camera_1")
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Verification Steps:</h4>
                      <div className="bg-yellow-50 rounded-lg p-4">
                        <div className="text-sm text-yellow-800">
                          <ol className="list-decimal list-inside space-y-1">
                            <li>Check that JSON bounds have correct labels ("person-employee", "person-customer")</li>
                            <li>Verify timestamps are in consistent format (both systems)</li>
                            <li>Ensure camera numbers match exactly</li>
                            <li>Confirm ActivityIDs exist in your database Activities table</li>
                            <li>Validate that database has monitoring records for the same date</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </details>

              {/* Performance Metrics */}
              {comparisonResults?.performanceMetrics && (
                <details className="bg-white rounded-xl shadow-lg">
                  <summary className="p-6 cursor-pointer hover:bg-gray-50 font-semibold text-gray-900 flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2 text-purple-600" />
                    ⚡ Performance Metrics & Processing Details
                    <span className="ml-auto text-sm text-gray-500">Click to expand/collapse</span>
                  </summary>
                  <div className="px-6 pb-6 border-t border-gray-200">
                    <div className="mt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-purple-50 rounded-lg p-4">
                          <h4 className="font-medium text-purple-900 mb-2">Processing Speed:</h4>
                          <div className="text-sm text-purple-800">
                            <p>Total Time: <strong>{comparisonResults.performanceMetrics.totalProcessingTimeMs}ms</strong></p>
                            <p>Activities/sec: <strong>{comparisonResults.performanceMetrics.activitiesProcessedPerSecond?.toLocaleString()}</strong></p>
                          </div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4">
                          <h4 className="font-medium text-green-900 mb-2">Results Summary:</h4>
                          <div className="text-sm text-green-800">
                            <p>Database Activities: <strong>{comparisonResults.totalDbActivities}</strong></p>
                            <p>Matches: <strong>{comparisonResults.matchedCount}</strong></p>
                            <p>Misses: <strong>{comparisonResults.unmatchedCount}</strong></p>
                            <p>Accuracy: <strong>{comparisonResults.accuracyPercentage}%</strong></p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </details>
              )}
            </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ActivityMonitoringUtility;