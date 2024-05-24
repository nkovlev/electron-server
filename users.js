const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

const supabaseUrl = "https://njznfalivirfsoamylaw.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qem5mYWxpdmlyZnNvYW15bGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI5MjQ1NjEsImV4cCI6MjAyODUwMDU2MX0.Qnr0mEK2n9K9PIKF2dz8VjHGEEueZjDNKddiNqMnXR8";
const supabase = createClient(supabaseUrl, supabaseKey);

const saltRounds = 10; 

router.post('/test',  () => {
    return "Hello";
});

router.post('/register', async (req, res) => {
  const { email_adress, password, full_name, id } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const { data: existingUser, error: existingUserError } = await supabase
        .from('users')
        .select()
        .eq('email_adress', email_adress);

    if (existingUserError) throw existingUserError;

    if (existingUser && existingUser.length > 0) {
        return res.status(400).json({ error: 'User with this email already exists' });
    }

    const { error: newUserError } = await supabase
        .from('users')
        .insert([{ email_adress, password: hashedPassword, full_name, id }])
        .single();

    if (newUserError) throw newUserError;

    const { data: createdUser, error: createdUserError } = await supabase
        .from('users')
        .select('id, full_name, email_adress')
        .eq('id', id)
        .single();

    if (createdUserError) throw createdUserError;

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

    if (error) throw error;

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const { error: updateUserError } = await supabase
      .from('users')
      .update({ active: true })
      .eq('id', user.id);

    if (updateUserError) throw updateUserError;

    res.status(200).json({ user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/logout', async (req, res) => {
  const { userId } = req.body;

  try {
    // Update user status to inactive
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ active: false })
      .eq('id', userId);

    if (updateUserError) throw updateUserError;

    res.status(200).json({ message: 'User logged out successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/room', async (req, res) => {
    const { chat_item_id, user_id } = req.body;

    try {
        // Проверяем, есть ли уже комната с такими пользователями для chat_item_id
        const { data: rooms1, error: roomsError1 } = await supabase
            .from('members')
            .select('room_id')
            .eq('user_id', chat_item_id);

        // Проверяем, есть ли уже комната с такими пользователями для user_id
        const { data: rooms2, error: roomsError2 } = await supabase
            .from('members')
            .select('room_id')
            .eq('user_id', user_id);

        if (roomsError1 || roomsError2) {
            throw roomsError1 || roomsError2;
        }

        // Проверяем, существует ли комната, содержащая обоих пользователей
        const commonRoom = rooms1.find(room => rooms2.some(r => r.room_id === room.room_id));

        let roomId;
        if (commonRoom) {
            roomId = commonRoom.room_id;
        } else {
            // Создаем новую комнату
            const { data: newRoom, error: roomError } = await supabase
                .from('rooms')
                .insert({})
                .select('id')
                .single();

            if (roomError) throw roomError;

            if (!newRoom || !newRoom.id) {
                throw new Error("Failed to create a new room");
            }

            roomId = newRoom.id;

            // Добавляем пользователей в таблицу members
            const { error: membersInsertError } = await supabase
                .from('members')
                .insert([
                    { room_id: roomId, user_id: chat_item_id },
                    { room_id: roomId, user_id: user_id }
                ]);

            if (membersInsertError) throw membersInsertError;
        }

        res.status(200).json({ roomId });
    } catch (error) {
        console.error("Error creating room:", error.message);
        res.status(400).json({ error: error.message });
    }
});

router.get("/rooms/:currentUserId", async (req, res) => {
    const { currentUserId } = req.params;
  
    try {
      // Получаем все комнаты, в которых состоит текущий пользователь
      const { data: userRooms, error: userRoomsError } = await supabase
        .from('members')
        .select('room_id')
        .eq('user_id', currentUserId);
  
      if (userRoomsError) throw userRoomsError;
  
      if (userRooms.length === 0) {
        return res.status(200).json({ rooms: [] });
      }
  
      const roomIds = userRooms.map(room => room.room_id);
  
      // Получаем данные других пользователей в этих комнатах
      const { data: members, error: membersError } = await supabase
        .from('members')
        .select('room_id, user_id')
        .in('room_id', roomIds);
  
      if (membersError) throw membersError;
  
      const otherUsersInRooms = members
        .filter(member => member.user_id !== currentUserId)
        .map(member => ({ room_id: member.room_id, user_id: member.user_id }));
  
      const uniqueUserIds = [...new Set(otherUsersInRooms.map(user => user.user_id))];
  
      // Получаем данные других пользователей
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, email_adress, active')
        .in('id', uniqueUserIds);
  
      if (usersError) throw usersError;
  
      const roomsWithUsers = otherUsersInRooms.map(entry => ({
        room_id: entry.room_id,
        user: users.find(user => user.id === entry.user_id)
      }));
  
      res.status(200).json({ rooms: roomsWithUsers });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
});

router.post('/messagesByRoomId', async (req, res) => {
    const { room_id } = req.body;
  
    try {
      const { data, error } = await supabase
        .from('chat_message')
        .select('*')
        .eq('room_id', room_id);
  
      if (error) {
        throw error;
      }  
      res.status(200).json(data);
    } catch (error) {
      console.error('Error fetching messages:', error.message);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

router.get("/lastMessage/:roomId", async (req, res) => {
    const { roomId } = req.params;

    try {
        const { data, error } = await supabase
            .from('chat_message')
            .select('*')
            .eq('room_id', roomId)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            throw error;
        }

        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching last message:', error.message);
        res.status(500).json({ error: 'Failed to fetch last message' });
    }
});

router.delete("/message/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('chat_message')
            .delete()
            .eq('id', id);

        if (error) {
            throw error;
        }

        res.status(200).json({ message: 'Message deleted successfully', data });
    } catch (error) {
        console.error('Error deleting message:', error.message);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

router.delete('/chat/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Удаление сообщений в чате
        const { data: messagesData, error: messagesError } = await supabase
            .from('chat_message')
            .delete()
            .eq('room_id', id);

        if (messagesError) {
            throw messagesError;
        }

        // Удаление участников чата
        const { data: membersData, error: membersError } = await supabase
            .from('members')
            .delete()
            .eq('room_id', id);

        if (membersError) {
            throw membersError;
        }

        // Удаление самого чата
        const { data: chatData, error: chatError } = await supabase
            .from('rooms')
            .delete()
            .eq('id', id);

        if (chatError) {
            throw chatError;
        }

        res.status(200).json({
            message: 'Chat, associated messages, and members deleted successfully',
            chatData,
            messagesData,
            membersData
        });
    } catch (error) {
        console.error('Error deleting chat, messages, and members:', error.message);
        res.status(500).json({ error: 'Failed to delete chat, messages, and members' });
    }
});


module.exports = router;


  

module.exports = router;
