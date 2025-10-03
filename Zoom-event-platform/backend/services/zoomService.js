const axios = require('axios');

class ZoomService {
  constructor() {
    this.accountId = process.env.ZOOM_ACCOUNT_ID;
    this.clientId = process.env.ZOOM_CLIENT_ID;
    this.clientSecret = process.env.ZOOM_CLIENT_SECRET;
    this.baseURL = 'https://api.zoom.us/v2';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Generate Access Token using Server-to-Server OAuth
  async getAccessToken() {
    try {
      // Check if token is still valid
      if (this.accessToken && this.tokenExpiry > Date.now()) {
        return this.accessToken;
      }

      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await axios.post('https://zoom.us/oauth/token', null, {
        params: {
          grant_type: 'account_credentials',
          account_id: this.accountId
        },
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.data.access_token;
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;
      
      return this.accessToken;
    } catch (error) {
      console.error('Zoom token error:', error.response?.data || error.message);
      throw new Error('Failed to get Zoom access token');
    }
  }

  // Make authenticated API request
  async makeRequest(method, endpoint, data = null) {
    try {
      const token = await this.getAccessToken();
      
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('Zoom API error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Zoom API request failed');
    }
  }

  // Create a new meeting
  async createMeeting(meetingData) {
    const defaultSettings = {
      type: 2, // Scheduled meeting
      duration: 60, // Default 1 hour
      timezone: 'UTC',
      password: this.generatePassword(),
      settings: {
        host_video: true,
        participant_video: true,
        cn_meeting: false,
        in_meeting: false,
        join_before_host: false,
        mute_upon_entry: true,
        watermark: false,
        use_pmi: false,
        approval_type: 2, // Automatically approve
        audio: 'both',
        auto_recording: 'none',
        enforce_login: false,
        enforce_login_domains: '',
        alternative_hosts: '',
        close_registration: false,
        show_share_button: true,
        allow_multiple_devices: true,
        registrants_confirmation_email: true,
        waiting_room: true,
        registrants_email_notification: true,
        meeting_authentication: false,
        additional_data_center_regions: []
      }
    };

    const meeting = { ...defaultSettings, ...meetingData };

    try {
      // Use 'me' as user ID for the authenticated account
      const result = await this.makeRequest('POST', '/users/me/meetings', meeting);
      
      return {
        id: result.id,
        uuid: result.uuid,
        host_id: result.host_id,
        topic: result.topic,
        type: result.type,
        status: result.status,
        start_time: result.start_time,
        duration: result.duration,
        timezone: result.timezone,
        password: result.password,
        join_url: result.join_url,
        start_url: result.start_url,
        created_at: result.created_at,
        settings: result.settings
      };
    } catch (error) {
      throw new Error(`Failed to create Zoom meeting: ${error.message}`);
    }
  }

  // Get meeting details
  async getMeeting(meetingId) {
    try {
      const meeting = await this.makeRequest('GET', `/meetings/${meetingId}`);
      return meeting;
    } catch (error) {
      throw new Error(`Failed to get meeting details: ${error.message}`);
    }
  }

  // Update meeting
  async updateMeeting(meetingId, updateData) {
    try {
      await this.makeRequest('PATCH', `/meetings/${meetingId}`, updateData);
      return await this.getMeeting(meetingId);
    } catch (error) {
      throw new Error(`Failed to update meeting: ${error.message}`);
    }
  }

  // Delete meeting
  async deleteMeeting(meetingId) {
    try {
      await this.makeRequest('DELETE', `/meetings/${meetingId}`);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete meeting: ${error.message}`);
    }
  }

  // List meetings for user
  async listMeetings(type = 'scheduled') {
    try {
      const response = await this.makeRequest('GET', `/users/me/meetings`, null, {
        type: type,
        page_size: 30
      });
      return response.meetings || [];
    } catch (error) {
      throw new Error(`Failed to list meetings: ${error.message}`);
    }
  }

  // Get meeting participants
  async getMeetingParticipants(meetingId) {
    try {
      const response = await this.makeRequest('GET', `/meetings/${meetingId}/participants`);
      return response.participants || [];
    } catch (error) {
      throw new Error(`Failed to get participants: ${error.message}`);
    }
  }

  // Generate meeting password
  generatePassword(length = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Get user information
  async getUserInfo() {
    try {
      const user = await this.makeRequest('GET', '/users/me');
      return {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        type: user.type,
        pmi: user.pmi,
        timezone: user.timezone,
        verified: user.verified,
        created_at: user.created_at,
        last_login_time: user.last_login_time
      };
    } catch (error) {
      throw new Error(`Failed to get user info: ${error.message}`);
    }
  }

  // Generate SDK JWT for frontend
  generateSDKJWT(meetingNumber, role = 0) {
    const jwt = require('jsonwebtoken');
    
    const payload = {
      iss: process.env.ZOOM_SDK_KEY,
      alg: 'HS256',
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 2) // 2 hours
    };

    const token = jwt.sign(payload, process.env.ZOOM_SDK_SECRET);
    
    return {
      signature: token,
      meetingNumber,
      role, // 0 = participant, 1 = host
      sdkKey: process.env.ZOOM_SDK_KEY,
      userName: 'User', // This should be dynamic based on actual user
      userEmail: '', // This should be dynamic based on actual user
      passWord: '' // Meeting password if required
    };
  }

  // Validate webhook signature
  validateWebhook(payload, signature) {
    const crypto = require('crypto');
    const computedSignature = crypto
      .createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
    
    return `sha256=${computedSignature}` === signature;
  }

  // Handle webhook events
  processWebhookEvent(event) {
    const { event: eventType, payload } = event;
    
    switch (eventType) {
      case 'meeting.started':
        console.log(`Meeting ${payload.object.id} started`);
        // Update event status in database
        break;
      case 'meeting.ended':
        console.log(`Meeting ${payload.object.id} ended`);
        // Update event status and collect analytics
        break;
      case 'meeting.participant_joined':
        console.log(`Participant joined meeting ${payload.object.id}`);
        // Track attendance
        break;
      case 'meeting.participant_left':
        console.log(`Participant left meeting ${payload.object.id}`);
        // Track attendance
        break;
      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }
  }
}

module.exports = new ZoomService();