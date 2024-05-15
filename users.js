const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

const supabaseUrl = "https://njznfalivirfsoamylaw.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qem5mYWxpdmlyZnNvYW15bGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI5MjQ1NjEsImV4cCI6MjAyODUwMDU2MX0.Qnr0mEK2n9K9PIKF2dz8VjHGEEueZjDNKddiNqMnXR8";
const supabase = createClient(supabaseUrl, supabaseKey);

const saltRounds = 10; 

router.post('/register', async (req, res) => {
  const { email_adress, password, full_name, id } = req.body;

  try {

      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const { data: existingUser, error: existingUserError } = await supabase
          .from('users')
          .select()
          .eq('email_adress', email_adress);

      if (existingUserError) {
          throw existingUserError;
      }

      if (existingUser && existingUser.length > 0) {
          return res.status(400).json({ error: 'User with this email already exists' });
      }

      const { error: newUserError } = await supabase
          .from('users')
          .insert([{ email_adress, password: hashedPassword, full_name, id }])
          .single();

      if (newUserError) {
          throw newUserError;
      }

      const { data: createdUser, error: createdUserError } = await supabase
          .from('users')
          .select('id, full_name, email_adress')
          .eq('id', id)
          .single();

      if (createdUserError) {
          throw createdUserError;
      }

      res.status(200).json({ user: createdUser });
  } catch (error) {
      res.status(400).json({ error: error.message });
  }
});


router.post('/login', async (req, res) => {
    const { email_adress, password } = req.body;

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, full_name, email_adress, password')
            .eq('email_adress', email_adress)
            .single();

        if (error) {
            throw error;
        }

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        res.status(200).json({ user });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/getmessage', async (req, res) => {
    const { chat_item_id, user_id } = req.body;
  
    try {
        const { data, error } = await supabase
            .from('chat_message')
            .select('id, sender_id, recepient_id, message_text, timestamp');
        
        if (error) {
            throw error;
        }

        const filteredData = data.filter(message =>
            (message.sender_id === chat_item_id && message.recepient_id === user_id) ||
            (message.sender_id === user_id && message.recepient_id === chat_item_id)
        );
  
        res.status(200).json({ data: filteredData });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

  



module.exports = router;
