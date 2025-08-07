const express = require('express');
const databaseService = require('../services/databaseService');
const router = express.Router();

// GET /api/activities - Get all activities
router.get('/', async (req, res) => {
  try {
    console.log('📋 Fetching activities from database...');
    const activities = await databaseService.getActivities();
    
    res.json({
      success: true,
      activities: activities,
      count: activities.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in GET /activities:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activities from database',
      error: process.env.NODE_ENV !== 'production' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/activities/:id - Get specific activity
router.get('/:id', async (req, res) => {
  try {
    const activityId = parseInt(req.params.id);
    
    if (isNaN(activityId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid activity ID - must be a number'
      });
    }

    const activity = await databaseService.getActivityById(activityId);
    
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: `Activity with ID ${activityId} not found`
      });
    }

    res.json({
      success: true,
      activity: activity
    });

  } catch (error) {
    console.error('❌ Error in GET /activities/:id:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity',
      error: process.env.NODE_ENV !== 'production' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;