package com.bibbidi.wedding.user.persistence;

import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.repository.UserMapper;
import com.bibbidi.wedding.user.repository.UserRepository;
import java.util.Optional;
import org.springframework.stereotype.Repository;

@Repository
public class JpaUserRepository implements UserRepository {

    private final UserDao userDao;
    private final UserMapper userMapper;

    public JpaUserRepository(UserDao userDao, UserMapper userMapper) {
        this.userDao = userDao;
        this.userMapper = userMapper;
    }

    @Override
    public boolean existsByNickname(String nickname) {
        return userDao.existsByNicknameIgnoreCase(nickname);
    }

    @Override
    public User save(User user) {
        UserEntity saved = userDao.save(userMapper.toEntity(user));
        return userMapper.toDomain(saved);
    }

    @Override
    public Optional<User> findByNickname(String nickname) {
        return userDao.findByNicknameIgnoreCase(nickname).map(userMapper::toDomain);
    }
}
