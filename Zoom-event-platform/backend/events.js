const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireSubscription, requireActiveSubscription } = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const zoomService = require('../services/zoomService');

const router = express.Router();
const prisma = new PrismaClient();

// Subscription limits
const SUBSCRIPTION_LIMITS = {
  TRIAL: {
    maxEvents: 3,
    maxAttendees: 12,
    maxDuration: 60 // minutes
  },
  STANDARD: {
    maxEvents: 10,
    maxAttendees: 250,
    maxDuration: 240 // minutes
  },
  PRO: {
    maxEvents: -1, // unlimited
    maxAttendees: 500,
    maxDuration: -1 // unlimited
  }
};

// @route   GET /api/events
// @desc    Get user events
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      userId: req.user.id
    };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { startTime: 'desc' },
        include: {
          attendees: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
              registrationTime: true
            }
          },
          resources: {
            select: {
              id: true,
              title: true,
              fileName: true,
              downloadUrl: true,
              downloadCount: true
            }
          },
          _count: {
            select: {
              attendees: true,
              sessions: true
            }
          }
        }
      }),
      prisma.event.count({ where })
    ]);

    res.json({
      events,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      error: 'Failed to get events',
      message: error.message
    });
  }
});

// @route   POST /api/events
// @desc    Create a new event
// @access  Private
router.post('/', [
  authenticateToken,
  requireActiveSubscription,
  body('title').trim().isLength({ min: 1 }).withMessage('Title is required'),
  body('startTime').isISO8601().withMessage('Valid start time is required'),
  body('endTime').isISO8601().withMessage('Valid end time is required'),
  body('maxAttendees').optional().isInt({ min: 1 }).withMessage('Max attendees must be a positive number')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      title,
      description,
      type = 'MEETING',
      startTime,
      endTime,
      timezone = 'UTC',
      maxAttendees,
      dashboardTemplate = 'CLASSIC',
      settings = {},
      createZoomMeeting = true
    } = req.body;

    // Check subscription limits
    const userSubscription = req.user.subscriptionTier;
    const limits = SUBSCRIPTION_LIMITS[userSubscription];

    // Check event count limit
    if (limits.maxEvents !== -1) {
      const eventCount = await prisma.event.count({
        where: { userId: req.user.id }
      });

      if (eventCount >= limits.maxEvents) {
        return res.status(403).json({
          error: 'Event limit exceeded',
          message: `Your ${userSubscription} subscription allows maximum ${limits.maxEvents} events`,
          currentCount: eventCount,
          limit: limits.maxEvents
        });
      }
    }

    // Validate attendee limit
    const attendeeLimit = maxAttendees || limits.maxAttendees;
    if (attendeeLimit > limits.maxAttendees) {
      return res.status(403).json({
        error: 'Attendee limit exceeded',
        message: `Your ${userSubscription} subscription allows maximum ${limits.maxAttendees} attendees`,
        requested: attendeeLimit,
        limit: limits.maxAttendees
      });
    }

    // Validate duration limit
    const duration = Math.ceil((new Date(endTime) - new Date(startTime)) / (1000 * 60)); // minutes
    if (limits.maxDuration !== -1 && duration > limits.maxDuration) {
      return res.status(403).json({
        error: 'Duration limit exceeded',
        message: `Your ${userSubscription} subscription allows maximum ${limits.maxDuration} minutes`,
        requested: duration,
        limit: limits.maxDuration
      });
    }

    // Validate start time is in the future
    if (new Date(startTime) <= new Date()) {
      return res.status(400).json({
        error: 'Invalid start time',
        message: 'Start time must be in the future'
      });
    }

    // Validate end time is after start time
    if (new Date(endTime) <= new Date(startTime)) {
      return res.status(400).json({
        error: 'Invalid end time',
        message: 'End time must be after start time'
      });
    }

    let zoomMeeting = null;

    // Create Zoom meeting if requested
    if (createZoomMeeting) {
      try {
        const meetingData = {
          topic: title,
          type: 2, // Scheduled meeting
          start_time: new Date(startTime).toISOString(),
          duration,
          timezone,
          agenda: description,
          settings: {
            host_video: true,
            participant_video: true,
            join_before_host: false,
            mute_upon_entry: true,
            waiting_room: true,
            approval_type: 2,
            ...settings
          }
        };

        zoomMeeting = await zoomService.createMeeting(meetingData);
      } catch (zoomError) {
        console.error('Zoom meeting creation failed:', zoomError);
        // Continue creating event without Zoom meeting
        // You can choose to fail here if Zoom integration is critical
      }
    }

    // Create event in database
    const event = await prisma.event.create({
      data: {
        title,
        description,
        type,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        timezone,
        maxAttendees: attendeeLimit,
        dashboardTemplate,
        settings: JSON.stringify(settings),
        userId: req.user.id,
        // Zoom integration fields
        zoomMeetingId: zoomMeeting?.id?.toString(),
        zoomMeetingUrl: zoomMeeting?.join_url,
        zoomPassword: zoomMeeting?.password,
        zoomHostKey: zoomMeeting?.start_url
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Event created successfully',
      event,
      zoomMeeting: zoomMeeting ? {
        id: zoomMeeting.id,
        join_url: zoomMeeting.join_url,
        start_url: zoomMeeting.start_url,
        password: zoomMeeting.password
      } : null
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      error: 'Failed to create event',
      message: error.message
    });
  }
});

// @route   GET /api/events/:id
// @desc    Get event by ID
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({
      where: {
        id,
        userId: req.user.id
      },
      include: {
        attendees: {
          orderBy: { registrationTime: 'desc' }
        },
        resources: {
          orderBy: { createdAt: 'desc' }
        },
        sessions: {
          orderBy: { startTime: 'asc' }
        },
        analytics: {
          orderBy: { recordedAt: 'desc' },
          take: 10
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!event) {
      return res.status(404).json({
        error: 'Event not found'
      });
    }

    // Parse settings JSON
    let settings = {};
    try {
      settings = event.settings ? JSON.parse(event.settings) : {};
    } catch (e) {
      console.error('Error parsing event settings:', e);
    }

    res.json({
      ...event,
      settings
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({
      error: 'Failed to get event',
      message: error.message
    });
  }
});

// @route   PUT /api/events/:id
// @desc    Update event
// @access  Private
router.put('/:id', [
  authenticateToken,
  body('title').optional().trim().isLength({ min: 1 }),
  body('startTime').optional().isISO8601(),
  body('endTime').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Check if event exists and belongs to user
    const existingEvent = await prisma.event.findUnique({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!existingEvent) {
      return res.status(404).json({
        error: 'Event not found'
      });
    }

    // Prepare update data
    const data = { ...updateData };
    
    if (data.startTime) {
      data.startTime = new Date(data.startTime);
    }
    
    if (data.endTime) {
      data.endTime = new Date(data.endTime);
    }
    
    if (data.settings) {
      data.settings = JSON.stringify(data.settings);
    }

    // Update Zoom meeting if it exists and meeting details changed
    if (existingEvent.zoomMeetingId && (updateData.title || updateData.startTime || updateData.endTime || updateData.description)) {
      try {
        const zoomUpdateData = {};
        
        if (updateData.title) zoomUpdateData.topic = updateData.title;
        if (updateData.description) zoomUpdateData.agenda = updateData.description;
        if (updateData.startTime) zoomUpdateData.start_time = new Date(updateData.startTime).toISOString();
        if (updateData.endTime && updateData.startTime) {
          zoomUpdateData.duration = Math.ceil((new Date(updateData.endTime) - new Date(updateData.startTime)) / (1000 * 60));
        }

        await zoomService.updateMeeting(existingEvent.zoomMeetingId, zoomUpdateData);
      } catch (zoomError) {
        console.error('Failed to update Zoom meeting:', zoomError);
        // Continue with event update even if Zoom update fails
      }
    }

    const updatedEvent = await prisma.event.update({
      where: { id },
      data,
      include: {
        attendees: true,
        resources: true,
        sessions: true
      }
    });

    res.json({
      message: 'Event updated successfully',
      event: updatedEvent
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({
      error: 'Failed to update event',
      message: error.message
    });
  }
});

// @route   DELETE /api/events/:id
// @desc    Delete event
// @access  Private
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!event) {
      return res.status(404).json({
        error: 'Event not found'
      });
    }

    // Delete Zoom meeting if it exists
    if (event.zoomMeetingId) {
      try {
        await zoomService.deleteMeeting(event.zoomMeetingId);
      } catch (zoomError) {
        console.error('Failed to delete Zoom meeting:', zoomError);
        // Continue with event deletion even if Zoom deletion fails
      }
    }

    await prisma.event.delete({
      where: { id }
    });

    res.json({
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({
      error: 'Failed to delete event',
      message: error.message
    });
  }
});

// @route   POST /api/events/:id/attendees
// @desc    Add attendee to event
// @access  Private
router.post('/:id/attendees', [
  authenticateToken,
  body('email').isEmail().normalizeEmail(),
  body('firstName').trim().isLength({ min: 1 }),
  body('lastName').trim().isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { email, firstName, lastName } = req.body;

    const event = await prisma.event.findUnique({
      where: {
        id,
        userId: req.user.id
      },
      include: {
        _count: {
          select: { attendees: true }
        }
      }
    });

    if (!event) {
      return res.status(404).json({
        error: 'Event not found'
      });
    }

    // Check attendee limit
    if (event._count.attendees >= event.maxAttendees) {
      return res.status(400).json({
        error: 'Event is full',
        message: `Maximum ${event.maxAttendees} attendees allowed`,
        current: event._count.attendees
      });
    }

    // Check if attendee already registered
    const existingAttendee = await prisma.attendee.findUnique({
      where: {
        email_eventId: {
          email,
          eventId: id
        }
      }
    });

    if (existingAttendee) {
      return res.status(400).json({
        error: 'Already registered',
        message: 'This email is already registered for the event'
      });
    }

    const attendee = await prisma.attendee.create({
      data: {
        email,
        firstName,
        lastName,
        eventId: id,
        joinUrl: event.zoomMeetingUrl // Add Zoom join URL
      }
    });

    // Update current attendee count
    await prisma.event.update({
      where: { id },
      data: {
        currentAttendees: {
          increment: 1
        }
      }
    });

    res.status(201).json({
      message: 'Attendee registered successfully',
      attendee
    });
  } catch (error) {
    console.error('Add attendee error:', error);
    res.status(500).json({
      error: 'Failed to register attendee',
      message: error.message
    });
  }
});

module.exports = router;