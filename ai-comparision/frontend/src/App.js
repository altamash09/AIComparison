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

  // Tab state
  const [activeTab, setActiveTab] = useState('matches');

  // Image popup state with camera selector
  const [imagePopup, setImagePopup] = useState({
    isOpen: false,
    imagePath: '',
    timestamp: '',
    camera: '',
    activity: '',
    selectedCamera: '',
    originalCamera: '',
    baseData: null
  });

  // Pagination states for each table
  const [matchesPagination, setMatchesPagination] = useState({ currentPage: 1, itemsPerPage: 10 });
  const [dbActivitiesPagination, setDbActivitiesPagination] = useState({ currentPage: 1, itemsPerPage: 10 });
  const [jsonActivitiesPagination, setJsonActivitiesPagination] = useState({ currentPage: 1, itemsPerPage: 10 });

  // API Configuration
  const API_BASE_URL = 'http://10.144.69.61:3901/api';

  // All helper functions defined immediately after state
  const getFilteredJsonActivitiesCount = useCallback(() => {
    if (!comparisonResults?.allJsonActivities) return 0;
  
    return comparisonResults.allJsonActivities
      .filter(activity => 
        activity.isMapped && 
        activity.activityId && 
        !['person-employee', 'person-customer'].includes(activity.label)
      )
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)) // ascending order
      .length;
  }, [comparisonResults?.allJsonActivities]);

  const getFilteredJsonActivities = useCallback(() => {
    if (!comparisonResults?.allJsonActivities) return [];
  
    return comparisonResults.allJsonActivities
      .filter(activity =>
        activity.isMapped &&
        activity.activityId &&
        !['person-employee', 'person-customer'].includes(activity.label)
      )
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); // ascending
  }, [comparisonResults?.allJsonActivities]);

  const calculateJsonActivityCount = useCallback((jsonData) => {
    if (!jsonData || !Array.isArray(jsonData)) return 0;
    
    let activityCount = 0;
    const ignoredLabels = ['person-employee', 'person-customer'];
    
    jsonData.forEach(record => {
      if (record.bounds && Array.isArray(record.bounds)) {
        record.bounds.forEach(bound => {
          if (bound.label && !ignoredLabels.includes(bound.label)) {
            activityCount++;
          }
        });
      }
    });
    
    return activityCount;
  }, []);

  // Helper functions defined early to avoid undefined errors
  const formatTimestamp = (timestamp) => {
    try {
      // Handle different timestamp formats without timezone conversion
      if (!timestamp) return 'N/A';
      
      // If it's already in a good format (YYYY-MM-DD HH:mm:ss), clean and return
      if (typeof timestamp === 'string' && timestamp.match(/^\d{4}-\d{2}-\d{2}/)) {
        // Remove milliseconds and clean up the format
        return timestamp.replace(/\.\d{3}$/, '').replace('T', ' ');
      }
      
      // For other formats, parse but format back to database-like format
      const date = new Date(timestamp);
      if (isNaN(date.getUTCTime())) return timestamp; // Return original if invalid
      
      // Format as YYYY-MM-DD HH:mm:ss (same as database format)
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
      const seconds = String(date.getUTCSeconds()).padStart(2, '0');
      
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
      console.warn('Error formatting timestamp:', timestamp, error);
      return timestamp; // Return original if there's an error
    }
  };

  const formatConfidence = (confidence) => {
    if (typeof confidence !== 'number') return { percentage: '0.0', level: 'low' };
    const percentage = (confidence * 100).toFixed(1);
    const level = confidence > 0.8 ? 'high' : confidence > 0.5 ? 'medium' : 'low';
    return { percentage, level };
  };

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
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Expected JSON but received ${contentType || 'unknown content type'}. Check if backend is running.`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to load activities');
      }
      
      setActivities(data.activities || []);
      console.log(`✅ Loaded ${data.activities?.length || 0} activities from database`);
      
    } catch (error) {
      console.error('❌ Error loading activities:', error);
      
      let errorMessage = 'Failed to load activities from database: ';
      
      if (error.message.includes('fetch')) {
        errorMessage += 'Cannot connect to backend server. Make sure backend is running.';
      } else {
        errorMessage += error.message;
      }
      
      setError(errorMessage);
      setActivities([]);
    } finally {
      setIsLoadingActivities(false);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const handleFileUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    setError(null);
    setUploadProgress(0);
    setComparisonResults(null);
    
    // Reset pagination
    setMatchesPagination({ currentPage: 1, itemsPerPage: 10 });
    setDbActivitiesPagination({ currentPage: 1, itemsPerPage: 10 });
    setJsonActivitiesPagination({ currentPage: 1, itemsPerPage: 10 });

    if (!file.name.toLowerCase().endsWith('.json')) {
      setError('Please select a valid JSON file (.json extension required)');
      return;
    }

    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      setError(`File size exceeds maximum limit of 100MB`);
      return;
    }

    const reader = new FileReader();
    
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('JSON file must contain an array of monitoring records');
        }

        // Validate required fields
        const requiredFields = ['company', 'store', 'date', 'camera', 'timestamp', 'image', 'bounds'];
        const firstRecord = data[0];
        const missingFields = requiredFields.filter(field => !(field in firstRecord));
        
        if (missingFields.length > 0) {
          throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        setJsonData(data);
        setUploadProgress(100);
        
        console.log(`📊 JSON Analysis:
          - Total records: ${data.length}
          - Store: ${firstRecord.store}
          - Company: ${firstRecord.company}
          - Date: ${firstRecord.date}`);
        
      } catch (error) {
        setError(`JSON file processing failed: ${error.message}`);
        setJsonData([]);
      }
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
    
    setProcessingProgress({
      show: true,
      percentage: 0,
      currentStep: 'Preparing data structures...',
      totalSteps: 4,
      currentStepIndex: 0,
      estimatedTimeRemaining: 0,
      startTime: Date.now()
    });

    try {
      console.log('🔄 Starting comparison process...');
      
      const formData = new FormData();
      const jsonBlob = new Blob([JSON.stringify(jsonData)], { type: 'application/json' });
      formData.append('jsonFile', jsonBlob, `monitoring-data-${Date.now()}.json`);
      
      const firstRecord = jsonData[0];
      formData.append('storeId', firstRecord.store?.toString() || '');
      formData.append('companyId', firstRecord.company?.toString() || '');
      formData.append('monitoringDate', firstRecord.date || '');

      // Simulate progress updates
      const steps = [
        'Preparing data structures...',
        'Extracting JSON activities...',
        'Comparing with database...',
        'Generating results...'
      ];

      for (let i = 0; i < steps.length - 1; i++) {
        setProcessingProgress(prev => ({
          ...prev,
          percentage: Math.round((i / steps.length) * 100),
          currentStep: steps[i],
          currentStepIndex: i
        }));
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const response = await fetch(`${API_BASE_URL}/monitoring/compare`, {
        method: 'POST',
        body: formData,
      });

      const responseData = await response.json();

      if (!response.ok || !responseData.success) {
        throw new Error(responseData.message || 'Comparison processing failed');
      }

      console.log('✅ Comparison completed:', responseData.data);
      setComparisonResults(responseData.data);
      
      // Reset pagination
      setMatchesPagination({ currentPage: 1, itemsPerPage: 10 });
      setDbActivitiesPagination({ currentPage: 1, itemsPerPage: 10 });
      setJsonActivitiesPagination({ currentPage: 1, itemsPerPage: 10 });
      
      setProcessingProgress(prev => ({
        ...prev,
        percentage: 100,
        currentStep: 'Comparison completed successfully!',
        currentStepIndex: steps.length - 1
      }));
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error('❌ Comparison Error:', error);
      setError(`Processing failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingProgress(prev => ({ ...prev, show: false }));
    }
  }, [jsonData, activities, API_BASE_URL]);

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
          totalRecordsProcessed: jsonData.length
        },
        summary: {
          accuracyPercentage: comparisonResults.accuracyPercentage,
          totalMatches: comparisonResults.matchedCount,
          totalDbActivities: comparisonResults.totalDbActivities,
          totalJsonActivities: comparisonResults.totalJsonActivities
        },
        results: {
          matches: comparisonResults.matches || [],
          unmatchedDb: comparisonResults.unmatchedDb || [],
          unmatchedJson: comparisonResults.unmatchedJson || [],
          allDbActivities: comparisonResults.allDbActivities || [],
          allJsonActivities: comparisonResults.allJsonActivities || []
        }
      };

      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `activity-comparison-report-${timestamp}.json`;
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      setError(`Failed to download report: ${error.message}`);
    }
  }, [comparisonResults, jsonData]);

  // Helper functions for pagination
  const getPaginatedData = useCallback((data, currentPage, itemsPerPage) => {
    if (!data || !Array.isArray(data)) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    return data.slice(startIndex, startIndex + itemsPerPage);
  }, []);

  const getTotalPages = useCallback((dataLength, itemsPerPage) => {
    return Math.ceil(dataLength / itemsPerPage);
  }, []);

  const constructImagePath = useCallback((data) => {
    try {
      // Extract info from the data
      const storeId = data.storeId || jsonData[0]?.store || comparisonResults?.metadata?.storeId;
      const timestamp = data.timestamp;
      const camera = data.camera;
      
      if (!storeId || !timestamp || !camera) {
        console.warn('Missing data for image path construction:', { storeId, timestamp, camera });
        return null;
      }

      let ts = timestamp;
      if (ts.includes("T")) {
        ts = ts.replace("T", " "); // Replace T with space
      }
      ts = ts.split(/[+Z]/)[0]; // Remove timezone offset or Z if present
  
      // Now ts is like "2025-08-06 08:27:00"
      const businessDate = ts.substring(0, 10).replace(/-/g, ""); // YYYYMMDD
      const timeStamp =
        businessDate +
        "_" +
        ts.substring(11, 19).replace(/:/g, ""); // HHMMSS

      // Construct the UNC path - use forward slashes internally
      const networkPath = `//10.144.70.130/e/DVR Bot/288/${storeId}/${businessDate}/${camera}/${timeStamp}.jpg`;
      
      // For display purposes, show the Windows UNC format
      const displayPath = `\\\\10.144.70.130\\e\\DVR Bot\\288\\${storeId}\\${businessDate}\\${camera}\\${timeStamp}.jpg`;
      
      // Backend API endpoint - properly encode the path
      const apiImagePath = `${API_BASE_URL}/image?path=${encodeURIComponent(networkPath)}`;
      
      console.log('🖼️ Image path constructed:', {
        networkPath,
        displayPath,
        apiImagePath,
        storeId,
        businessDate,
        camera,
        timeStamp
      });
      
      return {
        originalPath: displayPath,
        httpPath: apiImagePath,
        displayPath: displayPath,
        apiEndpoint: apiImagePath,
        networkPath: networkPath
      };
    } catch (error) {
      console.error('Error constructing image path:', error);
      return null;
    }
  }, [jsonData, comparisonResults, API_BASE_URL]);

  // Handle camera icon click
  const handleCameraClick = useCallback((data) => {
    const imagePathInfo = constructImagePath(data);

    if (imagePathInfo) {
      setImagePopup({
        isOpen: true,
        imagePath: imagePathInfo.httpPath,
        originalPath: imagePathInfo.originalPath,
        displayPath: imagePathInfo.displayPath,
        timestamp: data.timestamp,
        camera: data.camera,
        activity: data.activityName || data.ActivityName,
        selectedCamera: data.camera,
        originalCamera: data.camera,
        baseData: data
      });
    } else {
      // Show error if path construction failed
      setImagePopup({
        isOpen: true,
        imagePath: '',
        originalPath: '',
        displayPath: 'Error: Could not construct image path',
        timestamp: data.timestamp,
        camera: data.camera,
        activity: data.activityName || data.ActivityName,
        selectedCamera: data.camera,
        originalCamera: data.camera,
        baseData: data
      });
    }
  }, [constructImagePath]);

  // Handle camera number selection
  const handleCameraNumberSelect = useCallback((cameraNumber) => {
    if (!imagePopup.baseData) return;

    // Create new data object with selected camera
    const newData = {
      ...imagePopup.baseData,
      camera: cameraNumber.toString()
    };

    // Construct new image path
    const imagePathInfo = constructImagePath(newData);

    if (imagePathInfo) {
      setImagePopup(prev => ({
        ...prev,
        selectedCamera: cameraNumber.toString(),
        imagePath: imagePathInfo.httpPath,
        originalPath: imagePathInfo.originalPath,
        displayPath: imagePathInfo.displayPath
      }));
    }
  }, [imagePopup.baseData, constructImagePath]);

  // Close image popup
  const closeImagePopup = useCallback(() => {
    setImagePopup({
      isOpen: false,
      imagePath: '',
      originalPath: '',
      displayPath: '',
      timestamp: '',
      camera: '',
      activity: '',
      selectedCamera: '',
      originalCamera: '',
      baseData: null
    });
  }, []);

  // Pagination component
  const PaginationControls = ({ currentPage, totalItems, itemsPerPage, onPageChange, onItemsPerPageChange, label }) => {
    const totalPages = getTotalPages(totalItems, itemsPerPage);
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    if (totalItems === 0) return null;

    return (
      <div className="flex items-center justify-between mt-6 px-4 py-3 bg-white border-t border-gray-200">
        <div className="flex items-center space-x-4">
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{startItem}</span> to <span className="font-medium">{endItem}</span> of{' '}
            <span className="font-medium">{totalItems}</span> {label}
          </p>
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(parseInt(e.target.value))}
            className="text-sm border-gray-300 rounded-md px-2 py-1"
          >
            <option value={5}>5 per page</option>
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-3 py-1 border border-gray-300 rounded-md bg-white text-sm disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          
          <span className="text-sm text-gray-700">
            Page {currentPage} of {totalPages}
          </span>
          
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-3 py-1 border border-gray-300 rounded-md bg-white text-sm disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  // Image Popup Modal Component with Camera Selector
  const ImagePopupModal = () => {
    if (!imagePopup.isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div 
          className="relative max-w-2xl max-h-screen p-4 rounded-lg"
          style={{ backgroundColor: '#ffffff' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4 p-4 border-b">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {imagePopup.activity} - Camera {imagePopup.selectedCamera}
              </h3>
              <p className="text-sm text-gray-600">{formatTimestamp(imagePopup.timestamp)}</p>
            </div>
            <button
              onClick={closeImagePopup}
              className="popup-close-button"
              title="Close"
            >
              <XCircle className="popup-close-icon" />
            </button>
          </div>

          {/* Image Content */}
          <div className="max-h-96 overflow-auto">
            {imagePopup.imagePath ? (
              <div>
                <img
                  src={imagePopup.imagePath}
                  alt={`${imagePopup.activity} at ${imagePopup.timestamp}`}
                  className="max-w-2xl h-auto rounded-lg"
                  onError={(e) => {
                    console.error('Image failed to load:', imagePopup.imagePath);
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
                <div style={{ display: 'none' }} className="text-center p-8">
                  <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Image Not Available</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    The image could not be loaded from the network path.
                  </p>
                  <div className="bg-gray-100 p-3 rounded-lg text-left">
                    <p className="text-xs text-gray-700 font-mono break-all">
                      {imagePopup.displayPath}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-8">
                <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">Error</h4>
                <p className="text-sm text-gray-600">
                  Could not construct image path. Missing required data.
                </p>
              </div>
            )}
          </div>

          {/* Camera Selector Bar */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-center mb-4">
              <h4 className="text-lg font-semibold text-gray-800 mb-2 flex items-center justify-center">
                <Camera className="w-5 h-5 mr-2 text-blue-600" />
                Switch Camera View
              </h4>
              <p className="text-sm text-gray-500">Select a camera to view the same moment from different angles</p>
            </div>
            
            <div className="camera-selector-container">
              <div className="camera-buttons-row">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((cameraNumber) => {
                  const isSelected = imagePopup.selectedCamera === cameraNumber.toString();
                  return (
                    <button
                      key={cameraNumber}
                      onClick={() => handleCameraNumberSelect(cameraNumber)}
                      className={`camera-button ${isSelected ? 'camera-button-selected' : 'camera-button-default'}`}
                    >
                      <Camera className={`camera-icon ${isSelected ? 'camera-icon-selected' : 'camera-icon-default'}`} />
                      <span className="camera-number">{cameraNumber}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Current Selection Info */}
            <div className="text-center mt-4">
              <div className="inline-flex items-center px-3 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                Currently viewing Camera {imagePopup.selectedCamera}
                {imagePopup.selectedCamera !== imagePopup.originalCamera && (
                  <span className="ml-2 text-blue-600">
                    &nbsp; (Original: {imagePopup.originalCamera})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t flex justify-between items-center">
            <div className="text-xs text-gray-500">
              Path: {imagePopup.displayPath}
            </div>
            <button
              onClick={closeImagePopup}
              className="popup-footer-close-button"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Enhanced Tab component with custom CSS classes
  const TabButton = ({ id, label, count, isActive, onClick, icon }) => (
    <div className="tab-button-container">
      <button
        onClick={() => onClick(id)}
        className={`tab-button ${isActive ? 'tab-button-active' : 'tab-button-inactive'}`}
      >
        <div className="tab-button-content">
          {icon && <span className="tab-button-icon">{icon}</span>}
          <div className="tab-button-info">
            <div className="tab-button-label">{label}</div>
            {count !== undefined && (
              <div className={`tab-button-count ${isActive ? 'tab-button-count-active' : 'tab-button-count-inactive'}`}>
                {count}
              </div>
            )}
          </div>
        </div>
        {isActive && <div className="tab-button-active-indicator"></div>}
        <div className="tab-button-hover-overlay"></div>
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Stretch Zone AI Comparision</h1>
              <p className="text-lg text-gray-600">Compare AI detection data with agent monitoring activities</p>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
                <Database className="w-4 h-4" />
                <span>Production System</span>
              </div>
              {activities.length > 0 && (
                <div className="text-xs text-green-600">
                  ✅ {activities.length} activities loaded
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
                <p className="text-red-700 text-sm">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-3 text-red-600 hover:text-red-800"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* File Upload */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8 max-w-2xl mx-auto">
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
              disabled={isProcessing}
            />
            <label htmlFor="file-upload" className={`cursor-pointer ${isProcessing ? 'opacity-50' : ''}`}>
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-xl font-medium text-gray-900 mb-2">Choose JSON file</p>
              <p className="text-sm text-gray-500">Upload your activity monitoring JSON file</p>
            </label>
          </div>

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mt-4">
              <div className="upload-progress-container">
                <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }}></div>
              </div>
              <p className="text-sm text-gray-600 mt-2 text-center font-medium">Uploading... {uploadProgress}%</p>
            </div>
          )}
          
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
            </div>
          )}
        </div>

        {/* Processing Progress Modal */}
        {processingProgress.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full mx-4">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing Comparison</h3>
                <p className="text-sm text-gray-600 mb-6">{processingProgress.currentStep}</p>
                
                <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full transition-all"
                    style={{ width: `${processingProgress.percentage}%` }}
                  ></div>
                </div>
                
                <div className="text-sm text-gray-500">
                  {processingProgress.percentage}% Complete
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Spacer between Upload and Controls */}
        <div className="h-8"></div>

        {/* Control Buttons */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={processComparison}
              disabled={isProcessing || jsonData.length === 0 || activities.length === 0}
              className="flex items-center px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors text-lg font-semibold"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-6 h-6 mr-3 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <BarChart3 className="w-6 h-6 mr-3" />
                  Process Comparison
                </>
              )}
            </button>
            
            <button
              onClick={downloadReport}
              disabled={!comparisonResults}
              className="flex items-center px-6 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
            >
              <Download className="w-5 h-5 mr-2" />
              Download Report
            </button>

            <button
              onClick={loadActivities}
              disabled={isLoadingActivities}
              className="flex items-center px-6 py-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 mr-2 ${isLoadingActivities ? 'animate-spin' : ''}`} />
              Refresh Activities
            </button>
          </div>
        </div>

        {/* Results Dashboard */}
        {comparisonResults && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="summary-card summary-card-accuracy">
                <div className="summary-card-content">
                  <div className="summary-card-info">
                    <p className="summary-card-label">Detection Accuracy</p>
                    <p className="summary-card-value">{comparisonResults.accuracyPercentage || 0}%</p>
                    <div className="summary-card-subtitle">AI Model Performance</div>
                  </div>
                  <div className="summary-card-icon-container">
                    <CheckCircle className="summary-card-icon" />
                    <div className="summary-card-icon-glow"></div>
                  </div>
                </div>
                <div className="summary-card-bottom-gradient"></div>
              </div>
              
              <div className="summary-card summary-card-matches">
                <div className="summary-card-content">
                  <div className="summary-card-info">
                    <p className="summary-card-label">Accurate Matches</p>
                    <p className="summary-card-value">{comparisonResults.matchedCount || 0}</p>
                    <div className="summary-card-subtitle">Verified Activities</div>
                  </div>
                  <div className="summary-card-icon-container">
                    <Users className="summary-card-icon" />
                    <div className="summary-card-icon-glow"></div>
                  </div>
                </div>
                <div className="summary-card-bottom-gradient"></div>
              </div>
              
              <div className="summary-card summary-card-database">
                <div className="summary-card-content">
                  <div className="summary-card-info">
                    <p className="summary-card-label">Database Activities</p>
                    <p className="summary-card-value">{comparisonResults.totalDbActivities || 0}</p>
                    <div className="summary-card-subtitle">Total DB Records</div>
                  </div>
                  <div className="summary-card-icon-container">
                    <Database className="summary-card-icon" />
                    <div className="summary-card-icon-glow"></div>
                  </div>
                </div>
                <div className="summary-card-bottom-gradient"></div>
              </div>
              
              <div className="summary-card summary-card-json">
                <div className="summary-card-content">
                  <div className="summary-card-info">
                    <p className="summary-card-label">JSON Activities</p>
                    <p className="summary-card-value">{getFilteredJsonActivitiesCount()}</p>
                    <div className="summary-card-subtitle">Detected Events</div>
                  </div>
                  <div className="summary-card-icon-container">
                    <FileText className="summary-card-icon" />
                    <div className="summary-card-icon-glow"></div>
                  </div>
                </div>
                <div className="summary-card-bottom-gradient"></div>
              </div>
            </div>

            {/* Tabbed Results */}
            <div 
              className="rounded-xl shadow-lg mb-8 overflow-hidden"
              style={{ backgroundColor: '#ffffff' }}
            >
              {/* Tab Headers */}
              <div 
                className="px-8 pt-6 pb-4 border-b"
                style={{ 
                  backgroundColor: '#f3f4f6',
                  borderBottomColor: '#e5e7eb'
                }}
              >
                <nav className="flex justify-center space-x-4">
                  <TabButton
                    id="matches"
                    label="Accurate Matches"
                    count={comparisonResults.matches?.length || 0}
                    isActive={activeTab === 'matches'}
                    onClick={setActiveTab}
                    icon="✅"
                  />
                  <TabButton
                    id="database"
                    label="Database Activities"
                    count={comparisonResults.allDbActivities?.length || 0}
                    isActive={activeTab === 'database'}
                    onClick={setActiveTab}
                    icon="🗄️"
                  />
                  <TabButton
                    id="json"
                    label="JSON Activities"
                    count={getFilteredJsonActivitiesCount()}
                    isActive={activeTab === 'json'}
                    onClick={setActiveTab}
                    icon="📄"
                  />
                </nav>
              </div>

              {/* Tab Content */}
              <div 
                className="p-6"
                style={{ 
                  backgroundColor: '#ffffff',
                  minHeight: '400px'
                }}
              >
                {/* Accurate Matches Tab */}
                {activeTab === 'matches' && (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">
                      Activities Found in Both JSON and Database
                    </h3>
                    {comparisonResults.matches && comparisonResults.matches.length > 0 ? (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full table-auto">
                            <thead>
                              <tr style={{ backgroundColor: '#f9fafb' }}>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activity</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Camera</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {getPaginatedData(comparisonResults.matches, matchesPagination.currentPage, matchesPagination.itemsPerPage).map((match, index) => {
                                const confidence = formatConfidence(match.confidence);
                                return (
                                  <tr key={index} className="hover:bg-gray-50">
                                    <td className="px-4 py-4 text-sm text-gray-900">
                                      <div className="flex items-center">
                                        <Clock className="w-4 h-4 mr-2 text-gray-400" />
                                        {formatTimestamp(match.timestamp)}
                                      </div>
                                    </td>
                                    <td className="px-4 py-4 text-sm font-medium text-gray-900">{match.activityName}</td>
                                    <td className="px-4 py-4 text-sm text-gray-900">
                                      <div className="flex items-center">
                                        <button
                                          onClick={() => handleCameraClick(match)}
                                          className="camera-table-button"
                                          title="Click to view image"
                                        >
                                          <Camera className="camera-table-icon" />
                                          <span className="camera-table-text">{match.camera}</span>
                                        </button>
                                      </div>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-900">
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium`}
                                        style={{
                                          backgroundColor: confidence.level === 'high' ? '#dcfce7' : confidence.level === 'medium' ? '#fef3c7' : '#fee2e2',
                                          color: confidence.level === 'high' ? '#166534' : confidence.level === 'medium' ? '#92400e' : '#991b1b'
                                        }}
                                      >
                                        {confidence.percentage}%
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
                          label="matches"
                        />
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                        <p>No matching activities found between JSON and database</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Database Activities Tab */}
                {activeTab === 'database' && (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">
                      All Database Monitoring Activities
                    </h3>
                    {comparisonResults.allDbActivities && comparisonResults.allDbActivities.length > 0 ? (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full table-auto">
                            <thead>
                              <tr style={{ backgroundColor: '#f9fafb' }}>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activity</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Camera</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {getPaginatedData(comparisonResults.allDbActivities, dbActivitiesPagination.currentPage, dbActivitiesPagination.itemsPerPage).map((activity, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                  <td className="px-4 py-4 text-sm text-gray-900">
                                    <div className="flex items-center">
                                      <Clock className="w-4 h-4 mr-2 text-gray-400" />
                                      {formatTimestamp(activity.Timestamp)}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-sm font-medium text-gray-900">{activity.ActivityName}</td>
                                  <td className="px-4 py-4 text-sm text-gray-900">
                                    <div className="flex items-center">
                                      <button
                                        onClick={() => handleCameraClick({
                                          timestamp: activity.Timestamp,
                                          camera: activity.CameraNo,
                                          activityName: activity.ActivityName
                                        })}
                                        className="camera-table-button"
                                        title="Click to view image"
                                      >
                                        <Camera className="camera-table-icon" />
                                        <span className="camera-table-text">{activity.CameraNo}</span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <PaginationControls
                          currentPage={dbActivitiesPagination.currentPage}
                          totalItems={comparisonResults.allDbActivities.length}
                          itemsPerPage={dbActivitiesPagination.itemsPerPage}
                          onPageChange={(page) => setDbActivitiesPagination(prev => ({ ...prev, currentPage: page }))}
                          onItemsPerPageChange={(items) => setDbActivitiesPagination({ currentPage: 1, itemsPerPage: items })}
                          label="database activities"
                        />
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Database className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p>No database activities found</p>
                      </div>
                    )}
                  </div>
                )}

                {/* JSON Activities Tab */}
                {activeTab === 'json' && (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">
                      JSON Activities (Stretch Zone Activities Labels Only)
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Shows only stretch zone activity labels like "stretching", "cleaning", etc. 
                    </p>
                    {(() => {
                      const filteredActivities = getFilteredJsonActivities();
                      
                      return filteredActivities.length > 0 ? (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full table-auto">
                              <thead>
                                <tr style={{ backgroundColor: '#f9fafb' }}>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activity</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Camera</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">JSON Label</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {getPaginatedData(
                                  filteredActivities, 
                                  jsonActivitiesPagination.currentPage, 
                                  jsonActivitiesPagination.itemsPerPage
                                ).map((activity, index) => {
                                  const confidence = formatConfidence(activity.confidence);
                                  return (
                                    <tr key={index} className="hover:bg-gray-50">
                                      <td className="px-4 py-4 text-sm text-gray-900">
                                        <div className="flex items-center">
                                          <Clock className="w-4 h-4 mr-2 text-gray-400" />
                                          {formatTimestamp(activity.timestamp)}
                                        </div>
                                      </td>
                                      <td className="px-4 py-4 text-sm font-medium text-gray-900">{activity.activityName}</td>
                                      <td className="px-4 py-4 text-sm text-gray-900">
                                        <div className="flex items-center">
                                          <button
                                            onClick={() => handleCameraClick(activity)}
                                            className="camera-table-button"
                                            title="Click to view image"
                                          >
                                            <Camera className="camera-table-icon" />
                                            <span className="camera-table-text">{activity.camera}</span>
                                          </button>
                                        </div>
                                      </td>
                                      <td className="px-4 py-4 text-sm text-gray-900">
                                        <span 
                                          className="px-3 py-1 rounded-full text-xs font-medium"
                                          style={{
                                            backgroundColor: '#dcfce7',
                                            color: '#166534'
                                          }}
                                        >
                                          {activity.label}
                                        </span>
                                      </td>
                                      <td className="px-4 py-4 text-sm text-gray-900">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium`}
                                          style={{
                                            backgroundColor: confidence.level === 'high' ? '#dcfce7' : confidence.level === 'medium' ? '#fef3c7' : '#fee2e2',
                                            color: confidence.level === 'high' ? '#166534' : confidence.level === 'medium' ? '#92400e' : '#991b1b'
                                          }}
                                        >
                                          {confidence.percentage}%
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <PaginationControls
                            currentPage={jsonActivitiesPagination.currentPage}
                            totalItems={filteredActivities.length}
                            itemsPerPage={jsonActivitiesPagination.itemsPerPage}
                            onPageChange={(page) => setJsonActivitiesPagination(prev => ({ ...prev, currentPage: page }))}
                            onItemsPerPageChange={(items) => setJsonActivitiesPagination({ currentPage: 1, itemsPerPage: items })}
                            label="json activities"
                          />
                        </>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                          <p className="font-medium">No Specific Activity Labels Found</p>
                          <p className="text-sm mt-2">
                            No activities like "stretching", "cleaning", etc. were detected in the JSON file.
                          </p>
                          <p className="text-xs mt-1 text-gray-400">
                            Only showing specific activity labels, not generic "person-employee" or "person-customer" labels.
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Image Popup Modal */}
      <ImagePopupModal />
    </div>
  );
};

export default ActivityMonitoringUtility;